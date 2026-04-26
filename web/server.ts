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
        const playerId = `player_${socket.id.slice(0, 8)}`;
        const familyId = `family_${socket.id.slice(0, 8)}`;
        
        clients.set(socket.id, { playerId, familyId, selectedNpc: null });
        
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

        socket.emit('message', {
          type: 'game_state',
          data: {
            familyId,
            familyName: 'The Family',
            money: 100000,
            territories: ['Downtown']
          }
        });

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
          
          // Simply send a basic message back to test
          socket.emit('message', {
            type: 'thread_history',
            data: {
              npcId: npc.id,
              messages: []
            }
          });
          console.log('[Server] Sent empty history');
          
        } catch (e: unknown) {
          console.log('[Server] Error:', e);
        }
        break;
      }
          } else {
            console.log('[Server] Invalid select_npc event data');
          }
        } catch (err) {
          console.error('[Server] select_npc error:', err);
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
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: `You are ${npc.name}, a ${npc.role} in a mafia family. Your personality: ${npc.personality}. You answer messages from your Boss (the player). Keep responses brief (1-2 sentences), in character, never mention game mechanics.` },
                  { role: 'user', content: content }
                ],
                max_tokens: 150
              });
              
              const response = completion.choices[0]?.message?.content || "I understand, Boss.";
              
              // Add to history
              npc.messages.push({
                id: `msg_${Date.now()}_player`,
                sender: 'player',
                content,
                timestamp: new Date().toISOString()
              });
              npc.messages.push({
                id: `msg_${Date.now()}_npc`,
                sender: 'npc',
                content: response,
                timestamp: new Date().toISOString()
              });
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

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

export {};