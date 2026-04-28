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
  dayNumber?: number;
  isDay?: boolean;
  label?: string;
}

export type ServerEvent =
  | { type: 'npc_message'; data: NpcMessage }
  | { type: 'thread_history'; data: ThreadHistory }
  | { type: 'game_state'; data: GameState }
  | { type: 'thread_update'; data: Thread[] }
  | { type: 'error'; data: { message: string } };

export type ClientEvent =
  | { type: 'send_message'; data: PlayerMessage }
  | { type: 'join_game'; playerId?: string }
  | { type: 'select_npc'; data: { npcId: string } }
  | { type: 'mark_read'; data: { threadId: string } }
  | { type: 'reset_game' };

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
        if (event.type === 'game_state') {
          const gs = event.data as unknown as Record<string, unknown>;
          if (gs.label) {
            console.log(`[CURRENT GAME TIME] ${gs.label}`);
          }
        }
        
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
      console.log('[Socket] Sending event:', event.type, 'data' in event ? event.data : '');
      this.socket.emit('message', event);
    }
  }

  joinGame(playerId?: string): void {
    console.log('[Socket] Sending join_game for player:', playerId);
    this.send({ type: 'join_game', playerId });
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