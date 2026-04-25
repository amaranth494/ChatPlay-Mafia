import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
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
        // For MVP, create a temporary player/family
        const playerId = `player_${socket.id.slice(0, 8)}`;
        const familyId = `family_${socket.id.slice(0, 8)}`;
        
        clients.set(socket.id, { playerId, familyId });
        
        // Send initial threads (mock for MVP)
        socket.emit('message', {
          type: 'thread_update',
          data: [
            {
              id: 'thread_consiglieri',
              npcId: 'npc_consiglieri',
              npcName: 'Consigliere',
              lastMessageAt: new Date().toISOString(),
              unreadCount: 1,
              isArchive: false
            },
            {
              id: 'thread_luca',
              npcId: 'npc_luca',
              npcName: 'Luca "The Blade"',
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
              isArchive: false
            },
            {
              id: 'thread_marco',
              npcId: 'npc_marco',
              npcName: 'Marco',
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
              isArchive: false
            }
          ]
        });

        // Send game state
        socket.emit('message', {
          type: 'game_state',
          data: {
            familyId,
            familyName: 'The Family',
            money: 100000,
            territories: ['Downtown']
          }
        });

        // Send initial Consiglieri greeting
        socket.emit('message', {
          type: 'npc_message',
          data: {
            npcId: 'npc_consiglieri',
            content: "Boss, we've been waiting for you. Things have been... complicated while you were away. We need to discuss the situation with the territories. Meet me when you're ready.",
            timestamp: new Date().toISOString()
          }
        });
        break;

      case 'send_message':
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'content' in event.data) {
          const content = (event.data as { content: string }).content;
          
          // For MVP, echo back via Consiglieri after a delay
          setTimeout(() => {
            socket.emit('message', {
              type: 'npc_message',
              data: {
                npcId: 'npc_consiglieri',
                content: `I understand, Boss. "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}" - we'll discuss this further. The family is listening.`,
                timestamp: new Date().toISOString()
              }
            });
          }, 1500);
        }
        break;

      case 'mark_read':
        // Handle read receipts
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clients.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, httpServer, io };