import { io, Socket } from 'socket.io-client';

console.log('[Socket] Socket client loaded');

export interface PlayerMessage {
  content: string;
}

export interface NpcMessage {
  npcId: string;
  content: string;
  timestamp: string;
  sender?: 'player' | 'npc';
}

export interface ThreadMessage {
  id: string;
  sender: 'player' | 'npc';
  content: string;
  timestamp: string;
}

export interface ThreadHistory {
  npcId: string;
  messages: ThreadMessage[];
}

export interface Thread {
  id: string;
  npcId: string;
  npcName: string;
  lastMessageAt: string;
  unreadCount: number;
  isArchive: boolean;
}

export interface GameState {
  familyId: string;
  familyName: string;
  money: number;
  territories: string[];
}

export type ServerEvent =
  | { type: 'npc_message'; data: NpcMessage }
  | { type: 'thread_history'; data: ThreadHistory }
  | { type: 'game_state'; data: GameState }
  | { type: 'thread_update'; data: Thread[] }
  | { type: 'error'; data: { message: string } };

export type ClientEvent =
  | { type: 'send_message'; data: PlayerMessage }
  | { type: 'join_game' }
  | { type: 'select_npc'; data: { npcId: string } }
  | { type: 'mark_read'; data: { threadId: string } };

class ChatPlayClient {
  private socket: Socket | null = null;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();

  connect(serverUrl: string = ''): Promise<void> {
    const url = serverUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    console.log('[Socket] Connecting to:', url);
    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 3
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Disconnected from server');
      });

      this.socket.on('disconnect_error', (error) => {
        console.log('[Socket] Disconnect error:', error);
      });

      this.socket.on('message', (event: ServerEvent) => {
        console.log('[Socket] Received event:', event.type, event.data);
        const handlers = this.handlers.get(event.type);
        if (handlers) {
          handlers.forEach(handler => handler(event.data));
        } else {
          console.log('[Socket] No handler for event type:', event.type);
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on<T extends ServerEvent['type']>(
    eventType: T,
    handler: (data: Extract<ServerEvent, { type: T }>['data']) => void
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as (data: unknown) => void);
  }

  off<T extends ServerEvent['type']>(
    eventType: T,
    handler: (data: Extract<ServerEvent, { type: T }>['data']) => void
  ): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as (data: unknown) => void);
    }
  }

  send(event: ClientEvent): void {
    if (this.socket) {
      console.log('[Socket] Sending event:', event.type, 'data' in event ? event.data : '');
      this.socket.emit('message', event);
    }
  }

  joinGame(): void {
    console.log('[Socket] Sending join_game');
    this.send({ type: 'join_game' });
  }

  sendMessage(content: string): void {
    this.send({ type: 'send_message', data: { content } });
  }

  selectNpc(npcId: string): void {
    console.log('[Socket] Sending select_npc:', npcId);
    this.send({ type: 'select_npc', data: { npcId } });
  }

  markRead(threadId: string): void {
    this.send({ type: 'mark_read', data: { threadId } });
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const client = new ChatPlayClient();