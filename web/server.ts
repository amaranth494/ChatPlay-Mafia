import createNext from 'next';
import { createServer } from 'http';
import { parse } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import OpenAI from 'openai';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || process.env.RAILWAY_TCP_APPLICATION_PORT || process.env.WEB_PORT || '8080', 10);

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

interface NpcState {
  id: string;
  name: string;
  role: string;
  personality: string;
  lastMessage: string;
  messageCount: number;
}

const npcs: Record<string, NpcState> = {
  npc_consiglieri: {
    id: 'npc_consiglieri',
    name: 'Consigliere',
    role: 'Advisor',
    personality: 'Wary, strategic, speaks in measured tones. Always thinks three moves ahead.',
    lastMessage: '',
    messageCount: 0
  },
  npc_luca: {
    id: 'npcluca',
    name: 'Luca "The Blade"',
    role: 'Enforcer',
    personality: 'Short-tempered, violent, loyal but unpredictable. Speaks bluntly.',
    lastMessage: '',
    messageCount: 0
  },
  npc_marco: {
    id: 'npc_marco',
    name: 'Marco',
    role: 'Soldier',
    personality: 'Nervous, eager to please, relatively new to the family. Speaks formally.',
    lastMessage: '',
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
  console.log('Client connected:', socket.id);

  socket.on('message', async (event: { type: string; data?: unknown }) => {
    console.log('Received event:', event.type, event.data);
    
    switch (event.type) {
      case 'join_game': {
        const playerId = `player_${socket.id.slice(0, 8)}`;
        const familyId = `family_${socket.id.slice(0, 8)}`;
        
        clients.set(socket.id, { playerId, familyId, selectedNpc: null });
        
        const threads = Object.values(npcs).map(npc => ({
          id: `thread_${npc.id}`,
          npcId: npc.id,
          npcName: npc.name,
          lastMessageAt: npc.lastMessage ? new Date().toISOString() : new Date(Date.now() - 3600000).toISOString(),
          unreadCount: npc.messageCount > 0 ? 1 : 0,
          isArchive: false
        }));

        socket.emit('message', {
          type: 'thread_update',
          data: threads
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
      }

      case 'select_npc': {
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'npcId' in event.data) {
          client.selectedNpc = (event.data as { npcId: string }).npcId;
          
          const npc = npcs[client.selectedNpc];
          if (npc && npc.lastMessage) {
            socket.emit('message', {
              type: 'npc_message',
              data: {
                npcId: npc.id,
                content: npc.lastMessage,
                timestamp: new Date().toISOString()
              }
            });
          }
        }
        break;
      }

      case 'send_message': {
        const client = clients.get(socket.id);
        if (client && event.data && typeof event.data === 'object' && 'content' in event.data) {
          const content = (event.data as { content: string }).content;
          const npcId = client.selectedNpc || 'npc_consiglieri';
          const npc = npcs[npcId];
          
          if (npc && process.env.OPENAI_API_KEY) {
            try {
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: `You are ${npc.name}, a ${npc.role} in a mafia family. Your personality: ${npc.personality}. You answer messages from your Boss (the player). Keep responses brief (1-2 sentences), in character, never mention game mechanics.` },
                  { role: 'user', content: content }
                ],
                max_tokens: 150
              });
              
              const response = completion.choices[0]?.message?.content || "I understand, Boss.";
              
              npc.lastMessage = response;
              npc.messageCount++;
              
              socket.emit('message', {
                type: 'npc_message',
                data: {
                  npcId: npc.id,
                  content: response,
                  timestamp: new Date().toISOString()
                }
              });
            } catch (err) {
              console.error('OpenAI error:', err);
              const fallback = `I hear you, Boss. "${content.substring(0, 30)}..." - we'll discuss this further.`;
              npc.lastMessage = fallback;
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
          } else {
            const fallback = `I understand, Boss. "${content.substring(0, 30)}..." - we'll discuss this.`;
            npc.lastMessage = fallback;
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
              lastMessageAt: new Date().toISOString(),
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
          if (npcs[npcId]) {
            npcs[npcId].messageCount = 0;
          }
          
          socket.emit('message', {
            type: 'thread_update',
            data: Object.values(npcs).map(n => ({
              id: `thread_${n.id}`,
              npcId: n.id,
              npcName: n.name,
              lastMessageAt: n.lastMessage ? new Date().toISOString() : new Date(Date.now() - 3600000).toISOString(),
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

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

export {};