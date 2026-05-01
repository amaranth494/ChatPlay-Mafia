import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { getNpcLLMContext, recordPlayerInteraction, decayNpcTraits, processMemoryCausation, testConnection } from './db';
import { IntentParser, IntentValidator } from './game/intentParser';
import { MissionService } from './game/mission';
import { FamilyService } from './game/family';
import { NpcService } from './game/npc';

// v2.4 - NPC social simulation
dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3001;
const WS_PATH = process.env.WS_PATH || '/socket.io';

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: WS_PATH
});

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

interface ConnectedClient {
  playerId: string;
  familyId: string;
}

const clients = new Map<string, ConnectedClient>();

interface GameState {
  dayNumber: number;
  isDay: boolean;
}

let gameState: GameState = { dayNumber: 1, isDay: true };

async function loadGameState() {
  if (!pool) {
    console.log('[DB] No DATABASE_URL - using in-memory game state');
    return;
  }
  
  try {
    const result = await pool.query('SELECT * FROM game_state WHERE game_id = $1', ['default']);
    if (result.rows.length > 0) {
      gameState.dayNumber = result.rows[0].day_number;
      gameState.isDay = result.rows[0].is_day;
      console.log(`[DB] Loaded game state: Day ${gameState.dayNumber}, isDay ${gameState.isDay}`);
    } else {
      await pool.query(
        'INSERT INTO game_state (game_id, day_number, is_day, total_ticks) VALUES ($1, 1, TRUE, 0)',
        ['default']
      );
      console.log('[DB] Created default game state');
    }
  } catch (err) {
    console.error('[DB] Error loading game state:', err);
  }
}

async function saveGameState() {
  if (!pool) return;
  
  try {
    const totalTicks = getTotalTicks();
    await pool.query(
      'UPDATE game_state SET day_number = $2, is_day = $3, total_ticks = $4, updated_at = NOW() WHERE game_id = $1',
      ['default', gameState.dayNumber, gameState.isDay, totalTicks]
    );
  } catch (err) {
    console.error('[DB] Error saving game state:', err);
  }
}

function getTotalTicks() {
  return (gameState.dayNumber - 1) * 2 + (gameState.isDay ? 0 : 1);
}

loadGameState();

function resetGameTick() {
  gameState.dayNumber = 1;
  gameState.isDay = true;
  saveGameState();
}

function advanceTick() {
  if (gameState.isDay) {
    gameState.isDay = false;
  } else {
    gameState.isDay = true;
    gameState.dayNumber++;
  }
  
  const totalTicks = getTotalTicks();
  
  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
  const label = gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`;
  
  console.log(`[TICK] [${timeStr}] Tick=${totalTicks} ${label}`);
  
  // Process NPC social simulation tick
  decayNpcTraits(1).then(decayed => {
    if (decayed > 0) console.log(`[Tick] Decayed ${decayed} NPC traits`);
  });
  processMemoryCausation().then(caused => {
    if (caused > 0) console.log(`[Tick] Processed ${caused} memory causations`);
  });
  
  saveGameState();
  
  io.emit('message', {
    type: 'game_tick',
    data: {
      totalTicks,
      dayNumber: gameState.dayNumber,
      isDay: gameState.isDay,
      label: label
    }
  });
}

function scheduleNextTick() {
  const now = new Date();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const utcMs = now.getUTCMilliseconds();
  
  const minutesUntilNext = (30 - (utcMinutes % 30)) % 30;
  let delayMs = minutesUntilNext * 60 * 1000 - (utcSeconds * 1000 + utcMs);
  
  if (delayMs <= 0) delayMs += 30 * 60 * 1000;
  
  setTimeout(() => {
    advanceTick();
  }, delayMs);
  
  setInterval(advanceTick, 30 * 60 * 1000);
  
  console.log(`[Server] Next tick in ${(delayMs / 1000).toFixed(0)}s, then every 30 min at :00 and :30 UTC`);
}

scheduleNextTick();

async function executeIntent(intent: any, familyId: string, npcId: string, socket: any) {
  let response = '';

  switch (intent.type) {
    case 'mission': {
      const params = intent.params as any;
      try {
        const missionId = await MissionService.delegateMission(
          familyId,
          npcId,
          `Mission: ${params.objective}`,
          params.objective,
          params.difficulty,
          params.difficulty * 1000, // reward
          params.difficulty * 500   // penalty
        );
        // Simulate immediate resolution for MVP
        const result = await MissionService.resolveMission(missionId);
        response = `Mission accepted. Outcome: ${result.outcome}. Money: ${result.resultMoney > 0 ? '+' : ''}${result.resultMoney}`;
        if (result.resultInjury) response += '. Unfortunately, I was injured.';
      } catch (err: any) {
        response = `Cannot undertake mission: ${err.message}`;
      }
      break;
    }

    case 'promote': {
      // TODO: Implement promotion logic
      response = 'Promotion noted. I\'ll handle the arrangements.';
      break;
    }

    case 'demote': {
      // TODO: Implement demotion logic
      response = 'Demotion understood. Changes will be made.';
      break;
    }

    case 'status': {
      const family = await FamilyService.getFamily(familyId);
      response = family
        ? `Family status: Money: $${family.money}, Territories: ${family.territories.join(', ')}, Income: $${family.incomeRate}/day`
        : 'Family information unavailable.';
      break;
    }

    case 'clarify': {
      response = intent.clarification || 'Could you clarify what you mean?';
      break;
    }

    case 'chat': {
      response = 'I hear you. What would you like me to do?';
      break;
    }

    default:
      response = 'I\'m not sure what you mean.';
  }

  socket.emit('message', {
    type: 'npc_message',
    data: {
      content: response,
      timestamp: new Date().toISOString()
    }
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('message', (event: { type: string; data?: unknown }) => {
    console.log('Received event:', event.type, event.data);
    
    switch (event.type) {
      case 'join_game':
        socket.emit('message', {
          type: 'game_state',
          data: {
            totalTicks: getTotalTicks(),
            dayNumber: gameState.dayNumber,
            isDay: gameState.isDay,
            label: gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`
          }
        });
        console.log(`[CURRENT GAME TIME] ${gameState.isDay ? 'Day' : 'Night'} ${gameState.dayNumber} (Tick=${getTotalTicks()})`);
        break;

case 'send_message':
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'content' in event.data) {
          const content = (event.data as { content: string }).content;
          const npcId = (event.data as { npcId?: string }).npcId || 'consigliere';
          const playerId = client.playerId;
          const familyId = client.familyId;

          // Record player interaction
          if (playerId) {
            recordPlayerInteraction(npcId, playerId, content).catch(() => {});
          }

          // Parse intent
          const intent = IntentParser.parse(content, npcId);
          const validation = IntentValidator.validate(intent, familyId);

          if (!validation.valid) {
            socket.emit('message', {
              type: 'npc_message',
              data: {
                content: `Error: ${validation.error}`,
                timestamp: new Date().toISOString()
              }
            });
            break;
          }

          // Execute action
          executeIntent(intent, familyId, npcId, socket).catch(err => {
            console.error('Intent execution error:', err);
            socket.emit('message', {
              type: 'npc_message',
              data: {
                content: 'Something went wrong. Please try again.',
                timestamp: new Date().toISOString()
              }
            });
          });
        }
        break;

      case 'select_npc':
      case 'mark_read':
      case 'leave_thread':
        break;

      case 'reset_game':
        resetGameTick();
        console.log(`[GAME] Game reset to Tick=0, Day 1`);
        socket.emit('message', {
          type: 'game_state',
          data: {
            totalTicks: getTotalTicks(),
            dayNumber: gameState.dayNumber,
            isDay: gameState.isDay,
            label: gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`
          }
        });
        break;

      default:
        console.log('Unknown event type:', event.type);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clients.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, httpServer, io };