import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

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
            timestamp: new Date().toISOString()
          }
        });
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