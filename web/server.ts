import createNext from 'next';
import { createServer } from 'http';
import { parse } from 'url';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || process.env.RAILWAY_TCP_APPLICATION_PORT || '3000', 10);

const app = createNext({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url!, true);
  
  if (parsedUrl.pathname?.startsWith('/socket.io/')) {
    return;
  }
  
  handle(req, res, parsedUrl);
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io'
});

interface ConnectedClient {
  playerId: string;
  familyId: string;
}

const clients = new Map<string, ConnectedClient>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('message', (event: { type: string; data?: unknown }) => {
    console.log('Received event:', event.type, event.data);
    
    switch (event.type) {
      case 'join_game':
        const playerId = `player_${socket.id.slice(0, 8)}`;
        const familyId = `family_${socket.id.slice(0, 8)}`;
        
        clients.set(socket.id, { playerId, familyId });
        
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

        socket.emit('message', {
          type: 'game_state',
          data: {
            familyId,
            familyName: 'The Family',
            money: 100000,
            territories: ['Downtown']
          }
        });

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
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clients.delete(socket.id);
  });
});

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

export {};