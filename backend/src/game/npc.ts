import { getNpc, updateNpcHealth, updateNpcLoyalty, archiveNpc } from '../db';
import type { Npc, NpcHealth } from '../types';

export class NpcService {
  static async getNpc(npcId: string): Promise<Npc | null> {
    const dbNpc = await getNpc(npcId);
    if (!dbNpc) return null;

    return {
      id: dbNpc.id,
      familyId: dbNpc.familyId,
      name: dbNpc.name,
      role: dbNpc.role as any,
      health: dbNpc.health as NpcHealth,
      loyalty: dbNpc.loyalty,
      personality: dbNpc.personality,
      skills: dbNpc.skills,
      archived: dbNpc.archived,
      createdAt: new Date() // TODO: add to db
    };
  }

  static async updateHealth(npcId: string, health: NpcHealth): Promise<void> {
    await updateNpcHealth(npcId, health);
    if (health === 'dead') {
      await this.archiveNpc(npcId);
    }
  }

  static async updateLoyalty(npcId: string, change: number): Promise<void> {
    const npc = await this.getNpc(npcId);
    if (!npc) throw new Error('NPC not found');

    const newLoyalty = npc.loyalty + change;
    await updateNpcLoyalty(npcId, newLoyalty);
  }

  static async archiveNpc(npcId: string): Promise<void> {
    await archiveNpc(npcId);
  }

  // Check if NPC can perform mission based on health and loyalty
  static async canPerformMission(npcId: string): Promise<boolean> {
    const npc = await this.getNpc(npcId);
    if (!npc || npc.health === 'dead' || npc.archived) return false;
    return npc.loyalty > 20; // Minimum loyalty threshold
  }
}