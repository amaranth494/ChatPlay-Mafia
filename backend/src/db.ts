import { Pool } from 'pg';

const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export async function testConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

// Set NPC trait value
export async function setNpcTrait(
  npcId: string,
  targetId: string,
  targetType: string,
  traitType: string,
  value: number
): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO npc_traits (npc_id, target_id, target_type, trait_type, value, last_modified)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (npc_id, target_id, trait_type)
      DO UPDATE SET value = $5, last_modified = NOW()
    `, [npcId, targetId, targetType, traitType, Math.max(-100, Math.min(100, value))]);
  } finally {
    client.release();
  }
}

// Get traits for NPC
export async function getNpcTraits(npcId: string): Promise<Array<{
  targetId: string;
  targetType: string;
  traitType: string;
  value: number;
}>> {
  if (!pool) return [];
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT target_id as "targetId", target_type as "targetType", trait_type as "traitType", value
      FROM npc_traits WHERE npc_id = $1
    `, [npcId]);
    return result.rows;
  } finally {
    client.release();
  }
}

// Add memory
export async function addNpcMemory(
  npcId: string,
  eventType: string,
  description: string,
  emotionalImpact: number,
  sourceId?: string,
  expiresInDays?: number
): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    await client.query(`
      INSERT INTO npc_memories (npc_id, event_type, description, emotional_impact, source_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [npcId, eventType, description, Math.max(-100, Math.min(100, emotionalImpact)), sourceId, expiresAt]);
  } finally {
    client.release();
  }
}

// Get memories
export async function getNpcMemories(npcId: string): Promise<Array<{
  eventType: string;
  description: string;
  emotionalImpact: number;
  sourceId: string | null;
}>> {
  if (!pool) return [];
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT event_type as "eventType", description, emotional_impact as "emotionalImpact", source_id as "sourceId"
      FROM npc_memories 
      WHERE npc_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 10
    `, [npcId]);
    return result.rows;
  } finally {
    client.release();
  }
}

// Get NPC template for LLM context
export async function getNpcTemplate(npcId: string): Promise<{
  name: string;
  personality: string;
  backstory: string | null;
  speechPattern: string | null;
} | null> {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT name, personality, backstory, speech_pattern as "speechPattern"
      FROM npc_templates WHERE npc_id = $1
    `, [npcId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// Decay traits
export async function decayNpcTraits(decayRate: number = 1): Promise<number> {
  if (!pool) return 0;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE npc_traits 
      SET value = GREATEST(-100, LEAST(100, value - $1)),
          last_modified = NOW()
      WHERE value != 0
      RETURNING id
    `, [decayRate]);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

// Memory causation
export async function processMemoryCausation(): Promise<number> {
  if (!pool) return 0;
  const client = await pool.connect();
  try {
    const memories = await client.query(`
      SELECT npc_id, event_type, emotional_impact, source_id
      FROM npc_memories
      WHERE created_at < NOW() - INTERVAL '24 hours'
      AND expires_at IS NULL
      LIMIT 100
    `);
    let processed = 0;
    for (const m of memories.rows) {
      if (m.source_id && Math.abs(m.emotional_impact) > 30) {
        const traitMap: Record<string, string> = {
          'betrayal': 'loyalty', 'help': 'trust', 'threat': 'fear',
          'gift': 'trust', 'insult': 'respect', 'protection': 'loyalty'
        };
        const traitType = traitMap[m.event_type] || 'trust';
        const valueChange = m.emotional_impact > 0 ? -m.emotional_impact : Math.abs(m.emotional_impact);
        await setNpcTrait(m.npc_id, m.source_id, 'npc', traitType, valueChange);
        processed++;
      }
    }
    return processed;
  } finally {
    client.release();
  }
}

// Generate LLM context for NPC
export async function getNpcLLMContext(npcId: string): Promise<string> {
  const template = await getNpcTemplate(npcId);
  if (!template) return '';
  
  const traits = await getNpcTraits(npcId);
  const memories = await getNpcMemories(npcId);
  
  let context = `${template.name}: ${template.personality}`;
  if (template.backstory) context += ` ${template.backstory}`;
  if (template.speechPattern) context += ` Speaks: ${template.speechPattern}.`;
  
  if (traits.length > 0) {
    const keyTraits = traits.filter(t => Math.abs(t.value) > 30).slice(0, 3);
    if (keyTraits.length > 0) {
      context += ` Feelings: ${keyTraits.map(t => `${t.traitType}: ${t.value > 0 ? 'positive' : 'negative'}`).join(', ')}.`;
    }
  }
  
  if (memories.length > 0) {
    const recent = memories.slice(0, 2).map(m => m.description.substring(0, 50)).join('; ');
    if (recent) context += ` Recent: ${recent}.`;
  }
  
  return context;
}

// Record player interaction
export async function recordPlayerInteraction(
  npcId: string,
  playerUuid: string,
  messageContent: string
): Promise<void> {
  const lower = messageContent.toLowerCase();
  
  let eventType: string | null = null;
  let impact = 0;
  
  if (lower.includes('betray') || lower.includes('turn')) { eventType = 'betrayal'; impact = -80; }
  else if (lower.includes('help') || lower.includes('saved')) { eventType = 'help'; impact = 60; }
  else if (lower.includes('threat') || lower.includes('kill')) { eventType = 'threat'; impact = -50; }
  else if (lower.includes('gift') || lower.includes('bonus')) { eventType = 'gift'; impact = 40; }
  else if (lower.includes('insult') || lower.includes('idiot')) { eventType = 'insult'; impact = -40; }
  else if (lower.includes('protect') || lower.includes('safe')) { eventType = 'protection'; impact = 30; }
  
  if (eventType) {
    await addNpcMemory(npcId, eventType, messageContent.substring(0, 200), impact, playerUuid, 30);
    
    const traitMap: Record<string, string> = {
      'betrayal': 'trust', 'help': 'trust', 'threat': 'fear',
      'gift': 'trust', 'insult': 'respect', 'protection': 'loyalty'
    };
    const trait = traitMap[eventType] || 'trust';
    
    const traits = await getNpcTraits(npcId);
    const current = traits.find(t => t.targetId === playerUuid && t.traitType === trait);
    const currentValue = current?.value ?? 50;
    await setNpcTrait(npcId, playerUuid, 'player', trait, currentValue + impact / 2);
  }
}