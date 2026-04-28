import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// v2.1 - threads from database only
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

interface ConnectedClient {
  playerId: string;
  familyId: string;
}

const clients = new Map<string, ConnectedClient>();

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

function scheduleNextTick() {
  const now = new Date();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const utcMs = now.getUTCMilliseconds();
  
  const nextTickMs = (30 - (utcMinutes % 30)) * 60 * 1000 - (utcSeconds * 1000 + utcMs);
  const adjustedMs = nextTickMs <= 0 ? 30 * 60 * 1000 : nextTickMs;
  
  setTimeout(() => {
    advanceTick();
    setInterval(advanceTick, 30 * 60 * 1000);
  }, adjustedMs);
  
  const nextTickIn = adjustedMs / 1000;
  console.log(`[Server] First tick in ${nextTickIn.toFixed(0)}s, then every 30 min at :00 and :30 UTC`);
}

scheduleNextTick();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('message', (event: { type: string; data?: unknown }) => {
    console.log('Received event:', event.type, event.data);
    
    switch (event.type) {
      case 'join_game':
        // Frontend now handles threads from database - just acknowledge
        socket.emit('message', {
          type: 'game_state',
          data: {
            connected: true,
            timestamp: new Date().toISOString(),
            dayNumber: gameState.dayNumber,
            isDay: gameState.isDay,
            label: gameState.isDay ? `Day ${gameState.dayNumber}` : `Night ${gameState.dayNumber}`
          }
        });
        console.log(`[CURRENT GAME TIME] ${gameState.isDay ? 'Day' : 'Night'} ${gameState.dayNumber}`);
        break;

      case 'send_message':
        // Forward to AI for response
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'content' in event.data) {
          const content = (event.data as { content: string }).content;
          
// Simulate AI response (replace with real AI call later)
          setTimeout(() => {
            socket.emit('message', {
              type: 'npc_message',
              data: {
                content: `I understand. "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}" - The family is listening.`,
                timestamp: new Date().toISOString()
              }
            });
          }, 1500);
        }
        break;

      case 'select_npc':
      case 'mark_read':
      case 'leave_thread':
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