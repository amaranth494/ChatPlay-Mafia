import { io, Socket } from 'socket.io-client';

export interface PlayerMessage {
  content: string;
}

export interface NpcMessage {
  npcId: string;
  content: string;
  timestamp: string;
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
  | { type: 'game_state'; data: GameState }
  | { type: 'thread_update'; data: Thread[] }
  | { type: 'error'; data: { message: string } };

export type ClientEvent =
  | { type: 'send_message'; data: PlayerMessage }
  | { type: 'join_game' }
  | { type: 'mark_read'; data: { threadId: string } };

class ChatPlayClient {
  private socket: Socket | null = null;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();

  connect(serverUrl: string = process.env.NEXT_PUBLIC_API_URL || 'https://chatplay-mafia-production.up.railway.app'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        path: '/socket.io'
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      this.socket.on('message', (event: ServerEvent) => {
        const handlers = this.handlers.get(event.type);
        if (handlers) {
          handlers.forEach(handler => handler(event.data));
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
      this.socket.emit('message', event);
    }
  }

  joinGame(): void {
    this.send({ type: 'join_game' });
  }

  sendMessage(content: string): void {
    this.send({ type: 'send_message', data: { content } });
  }

  markRead(threadId: string): void {
    this.send({ type: 'mark_read', data: { threadId } });
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const client = new ChatPlayClient();