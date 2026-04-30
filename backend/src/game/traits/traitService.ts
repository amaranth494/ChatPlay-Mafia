import { Pool } from 'pg';
import { TraitId, TargetType, Intensity, isValidTraitId, isValidTargetType, isValidIntensity } from './traitDefinitions';

const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export interface TraitTarget {
  type: TargetType;
  id?: string;
}

export interface AddTraitInput {
  npcId: string;
  traitId: TraitId;
  target: TraitTarget;
  intensity: Intensity;
  source?: { type: string; id: string };
  expiresInDays?: number;
}

export interface TraitRow {
  id: number;
  npcId: string;
  traitId: string;
  targetType: string;
  targetId: string | null;
  intensity: string;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  expiresAt: string | null;
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function initializeTraitTables(): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    // Create new schema if columns don't match
    await client.query(`
      ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS trait_id VARCHAR(100);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS target_type VARCHAR(30);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS intensity VARCHAR(20) DEFAULT 'moderate';
    `).catch(() => {});
    await client.query(`
      ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
    `).catch(() => {});
    console.log('[DB] Trait tables initialized');
  } finally {
    client.release();
  }
}

export async function addTrait(input: AddTraitInput): Promise<TraitRow | null> {
  if (!pool) return null;
  
  const { npcId, traitId, target, intensity, source, expiresInDays } = input;
  
  if (!isValidTraitId(traitId)) {
    console.warn(`[Trait] Invalid traitId: ${traitId}`);
    return null;
  }
  if (!isValidTargetType(target.type)) {
    console.warn(`[Trait] Invalid target type: ${target.type}`);
    return null;
  }
  if (!isValidIntensity(intensity)) {
    console.warn(`[Trait] Invalid intensity: ${intensity}`);
    return null;
  }

  const client = await pool.connect();
  try {
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await client.query(`
      INSERT INTO npc_traits (npc_id, trait_id, target_type, target_id, intensity, source_type, source_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (npc_id, trait_id, target_type, target_id)
      DO UPDATE SET intensity = $5, source_type = $6, source_id = $7, last_modified = NOW()
      RETURNING id, npc_id, trait_id, target_type, target_id, intensity, source_type, source_id, created_at, expires_at
    `, [
      npcId, 
      traitId, 
      target.type, 
      target.id || null, 
      intensity,
      source?.type || null,
      source?.id || null,
      expiresAt
    ]);

    const row = result.rows[0];
    if (row) {
      console.log(`[Trait] Added ${traitId} (${intensity}) -> ${target.type}${target.id ? ':' + target.id : ''} for ${npcId}`);
    }
    return row ? {
      id: row.id,
      npcId: row.npc_id,
      traitId: row.trait_id,
      targetType: row.target_type,
      targetId: row.target_id,
      intensity: row.intensity,
      sourceType: row.source_type,
      sourceId: row.source_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    } : null;
  } finally {
    client.release();
  }
}

export async function removeTrait(input: { npcId: string; traitId: string; target: TraitTarget }): Promise<boolean> {
  if (!pool) return false;
  
  const { npcId, traitId, target } = input;
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      DELETE FROM npc_traits 
      WHERE npc_id = $1 AND trait_id = $2 AND target_type = $3 AND (target_id = $4 OR (target_id IS NULL AND $4 IS NULL))
    `, [npcId, traitId, target.type, target.id || null]);
    
    if (result.rowCount > 0) {
      console.log(`[Trait] Removed ${traitId} from ${npcId}`);
    }
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function hasTrait(input: { npcId: string; traitId: string; target: TraitTarget }): Promise<boolean> {
  if (!pool) return false;
  
  const { npcId, traitId, target } = input;
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 1 FROM npc_traits 
      WHERE npc_id = $1 AND trait_id = $2 AND target_type = $3 AND (target_id = $4 OR (target_id IS NULL AND $4 IS NULL))
    `, [npcId, traitId, target.type, target.id || null]);
    
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function getTraitsToward(npcId: string, targetType: TargetType, targetId?: string): Promise<TraitRow[]> {
  if (!pool) return [];
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, npc_id, trait_id, target_type, target_id, intensity, source_type, source_id, created_at, expires_at
      FROM npc_traits 
      WHERE npc_id = $1 AND target_type = $2 AND (target_id = $3 OR $3 IS NULL)
      ORDER BY 
        CASE intensity
          WHEN 'defining' THEN 1
          WHEN 'major' THEN 2
          WHEN 'moderate' THEN 3
          WHEN 'minor' THEN 4
        END
    `, [npcId, targetType, targetId || null]);
    
    return result.rows.map(row => ({
      id: row.id,
      npcId: row.npc_id,
      traitId: row.trait_id,
      targetType: row.target_type,
      targetId: row.target_id,
      intensity: row.intensity,
      sourceType: row.source_type,
      sourceId: row.source_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));
  } finally {
    client.release();
  }
}

export async function getSelfTraits(npcId: string): Promise<TraitRow[]> {
  if (!pool) return [];
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, npc_id, trait_id, target_type, target_id, intensity, source_type, source_id, created_at, expires_at
      FROM npc_traits 
      WHERE npc_id = $1 AND target_type = 'self'
      ORDER BY 
        CASE intensity
          WHEN 'defining' THEN 1
          WHEN 'major' THEN 2
          WHEN 'moderate' THEN 3
          WHEN 'minor' THEN 4
        END
    `, [npcId]);
    
    return result.rows.map(row => ({
      id: row.id,
      npcId: row.npc_id,
      traitId: row.trait_id,
      targetType: row.target_type,
      targetId: row.target_id,
      intensity: row.intensity,
      sourceType: row.source_type,
      sourceId: row.source_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));
  } finally {
    client.release();
  }
}

export async function getAllNpcTraits(npcId: string): Promise<TraitRow[]> {
  if (!pool) return [];
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, npc_id, trait_id, target_type, target_id, intensity, source_type, source_id, created_at, expires_at
      FROM npc_traits 
      WHERE npc_id = $1
      ORDER BY target_type, 
        CASE intensity
          WHEN 'defining' THEN 1
          WHEN 'major' THEN 2
          WHEN 'moderate' THEN 3
          WHEN 'minor' THEN 4
        END
    `, [npcId]);
    
    return result.rows.map(row => ({
      id: row.id,
      npcId: row.npc_id,
      traitId: row.trait_id,
      targetType: row.target_type,
      targetId: row.target_id,
      intensity: row.intensity,
      sourceType: row.source_type,
      sourceId: row.source_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));
  } finally {
    client.release();
  }
}

export async function seedNpcTraits(npcId: string, traits: Array<{ traitId: TraitId; target: TraitTarget; intensity: Intensity }>): Promise<number> {
  let seeded = 0;
  for (const t of traits) {
    const result = await addTrait({ npcId, ...t });
    if (result) seeded++;
  }
  return seeded;
}