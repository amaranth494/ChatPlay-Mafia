import { getFamily, updateFamilyMoney, addFamilyTerritory, removeFamilyTerritory, updateFamilyIncomeRate } from '../db';
import type { Family } from '../types';

export class FamilyService {
  static async getFamily(familyId: string): Promise<Family | null> {
    const dbFamily = await getFamily(familyId);
    if (!dbFamily) return null;

    return {
      id: dbFamily.id,
      name: dbFamily.name,
      money: dbFamily.money,
      incomeRate: dbFamily.incomeRate,
      territories: dbFamily.territories,
      createdAt: new Date() // TODO: add to db
    };
  }

  static async updateMoney(familyId: string, amount: number): Promise<void> {
    const family = await this.getFamily(familyId);
    if (!family) throw new Error('Family not found');

    const newMoney = family.money + amount;
    await updateFamilyMoney(familyId, newMoney);
  }

  static async addTerritory(familyId: string, territory: string): Promise<void> {
    await addFamilyTerritory(familyId, territory);
  }

  static async removeTerritory(familyId: string, territory: string): Promise<void> {
    await removeFamilyTerritory(familyId, territory);
  }

  static async updateIncomeRate(familyId: string, incomeRate: number): Promise<void> {
    await updateFamilyIncomeRate(familyId, incomeRate);
  }

  // Process daily income
  static async processDailyIncome(familyId: string): Promise<void> {
    const family = await this.getFamily(familyId);
    if (!family) return;

    const income = family.incomeRate * family.territories.length;
    if (income > 0) {
      await this.updateMoney(familyId, income);
    }
  }
}