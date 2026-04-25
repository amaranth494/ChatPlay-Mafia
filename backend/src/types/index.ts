export type NpcRole = 'consiglieri' | 'capo' | 'soldier' | 'associate';
export type NpcHealth = 'healthy' | 'wounded' | 'dead';
export type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type MissionOutcome = 'success' | 'partial' | 'failure' | 'catastrophic';

export interface Player {
  id: string;
  name: string;
  familyId: string;
  createdAt: Date;
}

export interface Family {
  id: string;
  name: string;
  money: number;
  incomeRate: number;
  territories: string[];
  createdAt: Date;
}

export interface Npc {
  id: string;
  familyId: string;
  name: string;
  role: NpcRole;
  health: NpcHealth;
  loyalty: number; // 0-100
  personality: string;
  skills: Record<string, number>; // e.g., { combat: 5, stealth: 3, negotiation: 7 }
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
}

export interface Relationship {
  id: string;
  familyId: string;
  npcId: string;
  targetNpcId?: string;
  type: 'npc_to_player' | 'npc_to_npc';
  value: number; // -100 to 100
}

export interface Mission {
  id: string;
  familyId: string;
  npcId: string;
  name: string;
  description: string;
  difficulty: number; // 1-10
  potentialReward: number;
  potentialPenalty: number;
  status: MissionStatus;
  outcome?: MissionOutcome;
  resultMoney?: number;
  resultInjury?: boolean;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Thread {
  id: string;
  playerId: string;
  npcId: string;
  isArchive: boolean;
  lastMessageAt: Date;
  unreadCount: number;
}

export interface Message {
  id: string;
  threadId: string;
  senderType: 'player' | 'npc';
  senderId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface GameEvent {
  id: string;
  familyId: string;
  type: 'mission_complete' | 'npc_death' | 'npc_joined' | 'territory_gained' | 'territory_lost';
  data: Record<string, unknown>;
  timestamp: Date;
}