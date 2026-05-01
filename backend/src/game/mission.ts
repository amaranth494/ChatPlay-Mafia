import { createMission, getMission, updateMissionStatus } from '../db';
import { NpcService } from './npc';
import { FamilyService } from './family';
import type { Mission, MissionOutcome } from '../types';

export class MissionService {
  static async delegateMission(
    familyId: string,
    npcId: string,
    name: string,
    description: string,
    difficulty: number,
    potentialReward: number,
    potentialPenalty: number
  ): Promise<string> {
    const npc = await NpcService.getNpc(npcId);
    if (!npc || npc.familyId !== familyId) {
      throw new Error('NPC not found or not in family');
    }

    if (!(await NpcService.canPerformMission(npcId))) {
      throw new Error('NPC cannot perform mission');
    }

    const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await createMission({
      id: missionId,
      familyId,
      npcId,
      name,
      description,
      difficulty,
      potentialReward,
      potentialPenalty
    });

    // Start mission immediately
    await this.startMission(missionId);

    return missionId;
  }

  static async startMission(missionId: string): Promise<void> {
    const mission = await getMission(missionId);
    if (!mission) throw new Error('Mission not found');

    await updateMissionStatus(missionId, 'in_progress');
  }

  static async resolveMission(missionId: string): Promise<{
    outcome: MissionOutcome;
    resultMoney: number;
    resultInjury: boolean;
  }> {
    const mission = await getMission(missionId);
    if (!mission) throw new Error('Mission not found');

    const npc = await NpcService.getNpc(mission.npcId);
    if (!npc) throw new Error('NPC not found');

    // Calculate success chance
    // Base success = NPC skills average + random factor - difficulty penalty
    const relevantSkills = ['combat', 'stealth', 'negotiation', 'intelligence'];
    const avgSkill = relevantSkills.reduce((sum, skill) => sum + (npc.skills[skill] || 0), 0) / relevantSkills.length;
    const randomFactor = Math.random() * 20 - 10; // -10 to +10
    const successScore = avgSkill + randomFactor - (mission.difficulty * 2);

    let outcome: MissionOutcome;
    let resultMoney: number;
    let resultInjury: boolean;

    if (successScore > 15) {
      outcome = 'success';
      resultMoney = mission.potentialReward;
      resultInjury = false;
    } else if (successScore > 5) {
      outcome = 'partial';
      resultMoney = Math.floor(mission.potentialReward * 0.5);
      resultInjury = Math.random() < 0.3;
    } else if (successScore > -5) {
      outcome = 'failure';
      resultMoney = -Math.floor(mission.potentialPenalty * 0.5);
      resultInjury = Math.random() < 0.5;
    } else {
      outcome = 'catastrophic';
      resultMoney = -mission.potentialPenalty;
      resultInjury = true;
    }

    // Apply results
    if (resultMoney !== 0) {
      await FamilyService.updateMoney(mission.familyId, resultMoney);
    }

    if (resultInjury) {
      const newHealth = npc.health === 'healthy' ? 'wounded' : 'dead';
      await NpcService.updateHealth(mission.npcId, newHealth);
    }

    // Update loyalty based on outcome
    let loyaltyChange = 0;
    if (outcome === 'success') loyaltyChange = 5;
    else if (outcome === 'partial') loyaltyChange = 2;
    else if (outcome === 'failure') loyaltyChange = -5;
    else if (outcome === 'catastrophic') loyaltyChange = -10;

    await NpcService.updateLoyalty(mission.npcId, loyaltyChange);

    await updateMissionStatus(missionId, 'completed', outcome, resultMoney, resultInjury);

    return { outcome, resultMoney, resultInjury };
  }

  static async getMission(missionId: string): Promise<Mission | null> {
    const dbMission = await getMission(missionId);
    if (!dbMission) return null;

    return {
      id: dbMission.id,
      familyId: dbMission.familyId,
      npcId: dbMission.npcId,
      name: dbMission.name,
      description: dbMission.description,
      difficulty: dbMission.difficulty,
      potentialReward: dbMission.potentialReward,
      potentialPenalty: dbMission.potentialPenalty,
      status: dbMission.status as any,
      outcome: dbMission.outcome as any,
      resultMoney: dbMission.resultMoney,
      resultInjury: dbMission.resultInjury,
      startedAt: new Date(), // TODO
      completedAt: new Date() // TODO
    };
  }
}