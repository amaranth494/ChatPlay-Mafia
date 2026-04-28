import createNext from 'next';
import { createServer } from 'http';
import { parse } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import OpenAI from 'openai';
import { testConnection, initDatabase, getOrCreateThread, saveMessage, getMessageHistory } from './lib/db';

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

interface Message {
  id: string;
  sender: 'player' | 'npc';
  content: string;
  timestamp: string;
}

interface NpcState {
  id: string;
  name: string;
  role: string;
  personality: string;
  messages: Message[];
  messageCount: number;
}

console.log('[Server] Initializing NPC states');

const npcs: Record<string, NpcState> = {
  npc_consiglieri: {
    id: 'npc_consiglieri',
    name: 'Consigliere',
    role: 'Advisor',
    personality: 'Wary, strategic, speaks in measured tones. Always thinks three moves ahead.',
    messages: [],
    messageCount: 0
  },
  npc_luca: {
    id: 'npc_luca',
    name: 'Luca "The Blade"',
    role: 'Enforcer',
    personality: 'Short-tempered, violent, loyal but unpredictable. Speaks bluntly.',
    messages: [],
    messageCount: 0
  },
  npc_marco: {
    id: 'npc_marco',
    name: 'Marco',
    role: 'Soldier',
    personality: 'Nervous, eager to please, relatively new to the family. Speaks formally.',
    messages: [],
    messageCount: 0
  }
};

interface ConnectedClient {
  playerId: string;
  familyId: string;
  selectedNpc: string | null;
}

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
        
        clients.set(socket.id, { playerId: clientPlayerId, familyId, selectedNpc: null });
        
        const threads = Object.values(npcs).map(npc => ({
          id: `thread_${npc.id}`,
          npcId: npc.id,
          npcName: npc.name,
          lastMessageAt: npc.messages.length > 0 
            ? npc.messages[npc.messages.length - 1].timestamp 
            : new Date(Date.now() - 3600000).toISOString(),
          unreadCount: npc.messageCount,
          isArchive: false
        }));

        socket.emit('message', {
          type: 'thread_update',
          data: threads
        });
        console.log('[Server] Sent thread_update');

        socket.emit('message', {
          type: 'game_state',
          data: {
            familyId,
            familyName: 'The Family',
            money: 100000,
            territories: ['Downtown'],
            dayNumber: gameState.dayNumber,
            isDay: gameState.isDay,
            label: gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`
          }
        });
        console.log('[Server] Sent game_state');
        console.log(`[CURRENT GAME TIME] ${gameState.isDay ? 'Day' : 'Night'} ${gameState.dayNumber}`);

        // Send welcome message from Consigliere
        const npc = npcs['npc_consiglieri'];
        const welcomeMsg: Message = {
          id: `msg_${Date.now()}`,
          sender: 'npc',
          content: "Boss, we've been waiting for you. Things have been... complicated while you were away. We need to discuss the situation with the territories. Meet me when you're ready.",
          timestamp: new Date().toISOString()
        };
        npc.messages.push(welcomeMsg);
        npc.messageCount++;

        socket.emit('message', {
          type: 'npc_message',
          data: {
            npcId: npc.id,
            content: welcomeMsg.content,
            timestamp: welcomeMsg.timestamp
          }
        });
        break;
      }

case 'select_npc': {
        console.log('[Server] select_npc START');
        try {
          const client = clients.get(socket.id);
          if (!client) {
            console.log('[Server] No client found');
            break;
          }
          
          const data = event.data as { npcId: string } | undefined;
          if (!data || !data.npcId) {
            console.log('[Server] No npcId in data');
            break;
          }
          
          client.selectedNpc = data.npcId;
          console.log('[Server] Selected:', data.npcId);
          
          const npc = npcs[data.npcId];
          if (!npc) {
            console.log('[Server] NPC not found:', data.npcId);
            break;
          }
          
          // Fetch history from database
          try {
            const threadId = await getOrCreateThread(data.npcId, client.playerId);
            const messages = await getMessageHistory(threadId);
            
            socket.emit('message', {
              type: 'thread_history',
              data: {
                npcId: npc.id,
                messages
              }
            });
            console.log('[Server] Sent history with', messages.length, 'messages');
          } catch (dbError) {
            console.error('[Server] DB error:', dbError);
            // Fallback to empty history
            socket.emit('message', {
              type: 'thread_history',
              data: {
                npcId: npc.id,
                messages: []
              }
            });
          }
          
        } catch (e: unknown) {
          console.log('[Server] Error:', e);
        }
        break;
      }

      case 'send_message': {
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'content' in event.data) {
          const content = (event.data as { content: string }).content;
          const npcId = client.selectedNpc || 'npc_consiglieri';
          const npc = npcs[npcId];
          
          console.log('[Server] Processing message for NPC:', npcId);
          
          if (npc && process.env.OPENAI_API_KEY) {
            try {
              const threadId = await getOrCreateThread(npcId, client.playerId);
              
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: `You are ${npc.name}, a ${npc.role} in a mafia family. Your personality: ${npc.personality}. You answer messages from your Boss (the player). Keep responses brief (1-2 sentences), in character, never mention game mechanics.` },
                  { role: 'user', content: content }
                ],
                max_tokens: 150
              });
              
              const response = completion.choices[0]?.message?.content || "I understand, Boss.";
              const timestamp = new Date().toISOString();
              
              // Save messages to database
              await saveMessage(threadId, 'player', content);
              await saveMessage(threadId, 'npc', response);
              
              socket.emit('message', {
                type: 'npc_message',
                data: {
                  npcId: npc.id,
                  content: response,
                  timestamp
                }
              });
            } catch (err) {
              console.error('OpenAI error:', err);
              const fallback = `I hear you, Boss. "${content.substring(0, 30)}..." - we'll discuss this further.`;
              const timestamp = new Date().toISOString();
              
              // Still save to database on error
              try {
                const threadId = await getOrCreateThread(npcId, client.playerId);
                await saveMessage(threadId, 'player', content);
                await saveMessage(threadId, 'npc', fallback);
              } catch (dbErr) {
                console.error('[Server] DB save error:', dbErr);
              }
              
              socket.emit('message', {
                type: 'npc_message',
                data: {
                  npcId: npc.id,
                  content: fallback,
                  timestamp
                }
              });
            }
          } else {
            const fallback = `I understand, Boss. "${content.substring(0, 30)}..." - we'll discuss this.`;
            
            npc.messages.push({
              id: `msg_${Date.now()}_player`,
              sender: 'player',
              content,
              timestamp: new Date().toISOString()
            });
            npc.messages.push({
              id: `msg_${Date.now()}_npc`,
              sender: 'npc',
              content: fallback,
              timestamp: new Date().toISOString()
            });
            npc.messageCount++;
            
            socket.emit('message', {
              type: 'npc_message',
              data: {
                npcId: npc.id,
                content: fallback,
                timestamp: new Date().toISOString()
              }
            });
          }
          
          socket.emit('message', {
            type: 'thread_update',
            data: Object.values(npcs).map(n => ({
              id: `thread_${n.id}`,
              npcId: n.id,
              npcName: n.name,
              lastMessageAt: n.messages.length > 0 
                ? n.messages[n.messages.length - 1].timestamp 
                : new Date().toISOString(),
              unreadCount: n.messageCount,
              isArchive: false
            }))
          });
        }
        break;
      }

      case 'mark_read': {
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'threadId' in event.data) {
          const threadId = (event.data as { threadId: string }).threadId;
          const npcId = threadId.replace('thread_', '');
          console.log('[Server] Marking thread as read:', npcId);
          
          if (npcs[npcId]) {
            npcs[npcId].messageCount = 0;
          }
          
          socket.emit('message', {
            type: 'thread_update',
            data: Object.values(npcs).map(n => ({
              id: `thread_${n.id}`,
              npcId: n.id,
              npcName: n.name,
              lastMessageAt: n.messages.length > 0 
                ? n.messages[n.messages.length - 1].timestamp 
                : new Date(Date.now() - 3600000).toISOString(),
              unreadCount: n.messageCount,
              isArchive: false
            }))
          });
        }
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