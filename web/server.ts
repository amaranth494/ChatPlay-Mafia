import createNext from 'next';
import { createServer } from 'http';
import { parse } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import OpenAI from 'openai';
import { testConnection, initDatabase, getOrCreateThread, saveMessage, getMessageHistory, getNpcByUuid, getNpcWithDetails } from './lib/db';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || process.env.RAILWAY_TCP_APPLICATION_PORT || process.env.WEB_PORT || '8080', 10);

console.log('[Server] Starting...');

// Test database on startup
if (process.env.DATABASE_URL) {
  console.log('[Server] Database URL found, testing connection...');
  testConnection().then(ok => {
    if (ok) {
      console.log('[Server] Database OK, initializing tables...');
      initDatabase();
    }
  });
} else {
  console.log('[Server] No DATABASE_URL - running without database');
}

const app = createNext({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url!, true);
  handle(req, res, parsedUrl);
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io'
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ConnectedClient {
  playerId: string;
  familyId: string;
}

// UUID validator (canonical 8-4-4-4-12 form)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const clients = new Map<string, ConnectedClient>();

io.on('connection', (socket) => {
  console.log('[Server] ★ Client connected:', socket.id);

  socket.on('message', async (event: { type: string; data?: unknown }) => {
    console.log('[Server] ★ Received:', event.type);
    
    if (event.type === 'select_npc') {
      console.log('[Server] Processing select_npc NOW');
    }
    
    switch (event.type) {
      case 'join_game': {
        console.log('[Server] join_game START');
        const eventData = event as { type: string; playerId?: string };
        const clientPlayerId = eventData.playerId || `player_${socket.id.slice(0, 8)}`;
        const familyId = `family_${socket.id.slice(0, 8)}`;

        clients.set(socket.id, { playerId: clientPlayerId, familyId });

        // Thread list is loaded by the client from the DB (UUID-based).
        // We intentionally do NOT emit a hardcoded thread_update here.

        socket.emit('message', {
          type: 'game_state',
          data: {
            dayNumber: gameState.dayNumber,
            isDay: gameState.isDay,
            label: gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`
          }
        });
        console.log('[Server] Sent game_state');
        console.log(`[CURRENT GAME TIME] ${gameState.isDay ? 'Day' : 'Night'} ${gameState.dayNumber}`);
        break;
      }

      case 'select_npc': {
        const data = event.data as { npcId?: string } | undefined;
        const npcUuid = data?.npcId;
        console.log('[Server] select_npc received:', npcUuid);
        if (!npcUuid || !isUuid(npcUuid)) {
          console.log('[Server] select_npc rejected: valid UUID required');
        }
        break;
      }

      case 'send_message': {
        const client = clients.get(socket.id);
        if (!client || !event.data || typeof event.data !== 'object' || !('content' in event.data)) {
          break;
        }
        const content = (event.data as { content: string }).content;
        const providedNpcId = (event.data as { npcId?: string }).npcId;

        if (!isUuid(providedNpcId)) {
          console.log('[Server] send_message rejected: npcId must be a UUID, got:', providedNpcId);
          socket.emit('message', {
            type: 'error',
            data: { message: 'npcId must be a UUID' }
          });
          break;
        }

        const npcUuid = providedNpcId;
        const npc = await getNpcWithDetails(npcUuid);
        if (!npc) {
          console.log('[Server] NPC not found:', npcUuid);
          socket.emit('message', {
            type: 'npc_message',
            data: {
              npcId: npcUuid,
              content: "I'm not available right now, Boss.",
              timestamp: new Date().toISOString()
            }
          });
          break;
        }

        console.log('[Server] Processing message for NPC:', npcUuid, `(${npc.name})`);

        const threadId = await getOrCreateThread(npcUuid, client.playerId);
        await saveMessage(threadId, 'player', content);

        // Build rich system prompt from all NPC details
        let systemPrompt = `You are ${npc.name}. `;
        systemPrompt += `Role: ${npc.role}. `;
        if (npc.personality) systemPrompt += `Personality: ${npc.personality}. `;
        if (npc.backstory) systemPrompt += `Backstory: ${npc.backstory}. `;
        if (npc.speechPattern) systemPrompt += `Speech style: ${npc.speechPattern}`;
        systemPrompt += ` You answer messages from your Boss (the player). Keep responses brief (1-2 sentences), always in character, never mention game mechanics.`;

        let responseText: string;
        if (process.env.OPENAI_API_KEY) {
          try {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: content }
              ],
              max_tokens: 150
            });
            responseText = completion.choices[0]?.message?.content || "I understand, Boss.";
          } catch (err) {
            console.error('OpenAI error:', err);
            responseText = `I hear you, Boss. "${content.substring(0, 30)}..." - we'll discuss this further.`;
          }
        } else {
          responseText = `I understand, Boss. "${content.substring(0, 30)}..." - we'll discuss this.`;
        }

        const timestamp = new Date().toISOString();
        await saveMessage(threadId, 'npc', responseText);

        socket.emit('message', {
          type: 'npc_message',
          data: {
            npcId: npcUuid,
            content: responseText,
            timestamp
          }
        });
        break;
      }

      case 'mark_read': {
        const client = clients.get(socket.id);
        if (!client || !event.data || typeof event.data !== 'object' || !('threadId' in event.data)) {
          break;
        }
        // Thread read-state is managed client-side / via DB elsewhere.
        // No hardcoded NPC bookkeeping here.
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clients.delete(socket.id);
  });
});

interface GameState {
  dayNumber: number;
  isDay: boolean;
}

const gameState: GameState = {
  dayNumber: 1,
  isDay: true
};

function advanceTick() {
  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
  
  if (gameState.isDay) {
    gameState.isDay = false;
    console.log(`[TICK] [${timeStr}] Night ${gameState.dayNumber}`);
  } else {
    gameState.isDay = true;
    gameState.dayNumber++;
    console.log(`[TICK] [${timeStr}] Day ${gameState.dayNumber}`);
  }
  
  io.emit('message', {
    type: 'game_tick',
    data: {
      dayNumber: gameState.dayNumber,
      isDay: gameState.isDay,
      label: gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`
    }
  });
}

const TICK_INTERVAL = 30 * 60 * 1000;

setInterval(advanceTick, TICK_INTERVAL);
console.log(`[Server] Game tick cycle started (every ${TICK_INTERVAL / 60000} minutes)`);

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

export {};