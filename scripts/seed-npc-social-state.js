const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:mbADBQGytUrPGavlQGvmqfkguJVGSohT@shortline.proxy.rlwy.net:47702/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const NPC_STARTER_TRAITS = {
  'consigliere': [
    { traitId: 'trait_loyal', target: { type: 'player' }, intensity: 'major' },
    { traitId: 'trait_protective', target: { type: 'player' }, intensity: 'major' },
    { traitId: 'trait_trusting', target: { type: 'player' }, intensity: 'moderate' },
    { traitId: 'trait_calculating', target: { type: 'self' }, intensity: 'major' },
    { traitId: 'trait_respectful', target: { type: 'player' }, intensity: 'major' },
    { traitId: 'trait_trusted_with_secrets', target: { type: 'self' }, intensity: 'major' },
  ],
  'capo': [
    { traitId: 'trait_loyal', target: { type: 'player' }, intensity: 'major' },
    { traitId: 'trait_violent', target: { type: 'self' }, intensity: 'major' },
    { traitId: 'trait_short_tempered', target: { type: 'self' }, intensity: 'major' },
    { traitId: 'trait_respectful', target: { type: 'player' }, intensity: 'moderate' },
  ],
  'soldier': [
    { traitId: 'trait_wants_approval', target: { type: 'player' }, intensity: 'major' },
    { traitId: 'trait_respectful', target: { type: 'player' }, intensity: 'moderate' },
    { traitId: 'trait_fearful', target: { type: 'self' }, intensity: 'moderate' },
    { traitId: 'trait_ambitious', target: { type: 'self' }, intensity: 'major' },
    { traitId: 'trait_inexperienced', target: { type: 'self' }, intensity: 'moderate' },
  ],
};

const BACKSTORY_MEMORIES = [
  {
    npcId: 'consigliere',
    eventType: 'backstory',
    description: 'Salvatore once saved the Boss from an ambush and has served as advisor ever since.',
    emotionalImpact: 80, // major = 80
    traitEffects: {
      add: [
        { trait_id: 'trait_loyal', target_type: 'player', intensity: 'major' },
        { trait_id: 'trait_protective', target_type: 'player', intensity: 'major' },
        { trait_id: 'trait_respectful', target_type: 'player', intensity: 'major' },
      ],
      remove: []
    }
  },
  {
    npcId: 'capo',
    eventType: 'backstory',
    description: 'Luca rose through the ranks as an enforcer and is known for his violence and fierce loyalty.',
    emotionalImpact: 50, // moderate = 50
    traitEffects: {
      add: [
        { trait_id: 'trait_loyal', target_type: 'player', intensity: 'major' },
        { trait_id: 'trait_violent', target_type: 'self', intensity: 'major' },
        { trait_id: 'trait_short_tempered', target_type: 'self', intensity: 'major' },
      ],
      remove: []
    }
  },
  {
    npcId: 'soldier',
    eventType: 'backstory',
    description: 'Marco is a nervous new recruit from the old neighborhood who wants to prove himself.',
    emotionalImpact: 50, // moderate = 50
    traitEffects: {
      add: [
        { trait_id: 'trait_wants_approval', target_type: 'player', intensity: 'major' },
        { trait_id: 'trait_ambitious', target_type: 'self', intensity: 'major' },
        { trait_id: 'trait_fearful', target_type: 'self', intensity: 'moderate' },
      ],
      remove: []
    }
  },
];

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function initializeTables() {
  const client = await pool.connect();
  try {
    // Drop old nullable constraint
    await client.query(`ALTER TABLE npc_traits ALTER COLUMN target_id DROP NOT NULL`).catch(() => {});
    await client.query(`ALTER TABLE npc_traits ALTER COLUMN trait_type DROP NOT NULL`).catch(() => {});
    
    // Add new columns
    await client.query(`ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS trait_id VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS target_type VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS intensity VARCHAR(20) DEFAULT 'moderate'`).catch(() => {});
    await client.query(`ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS source_type VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE npc_traits ADD COLUMN IF NOT EXISTS source_id VARCHAR(100)`).catch(() => {});
    
    // Clear old traits and start fresh
    await client.query(`DELETE FROM npc_traits WHERE trait_id IS NULL`).catch(() => {});
    
    await client.query(`ALTER TABLE npc_memories ADD COLUMN IF NOT EXISTS memory_uuid VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE npc_memories ADD COLUMN IF NOT EXISTS trait_effects_json JSONB DEFAULT '{}'`).catch(() => {});
    
    console.log('[OK] Tables initialized');
  } finally {
    client.release();
  }
}

async function seedTraits() {
  let totalSeeded = 0;
  
  for (const [npcId, traits] of Object.entries(NPC_STARTER_TRAITS)) {
    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT COUNT(*) FROM npc_traits WHERE npc_id = $1 AND target_type = 'player' AND trait_id = 'trait_loyal'`,
        [npcId]
      );
      
      if (parseInt(existing.rows[0].count) > 0) {
        console.log(`[SKIP] ${npcId}: traits already exist`);
        continue;
      }
      
      for (const t of traits) {
        await client.query(`
          INSERT INTO npc_traits (npc_id, trait_id, target_type, target_id, intensity, source_type, source_id)
          VALUES ($1, $2, $3, $4, $5, 'seed', 'initial')
        `, [npcId, t.traitId, t.target.type, t.target.id || null, t.intensity]);
        totalSeeded++;
      }
      console.log(`[OK] ${npcId}: seeded ${traits.length} traits`);
    } finally {
      client.release();
    }
  }
  
  return totalSeeded;
}

async function seedMemories() {
  let totalSeeded = 0;
  
  for (const mem of BACKSTORY_MEMORIES) {
    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT COUNT(*) FROM npc_memories WHERE npc_id = $1 AND event_type = 'backstory'`,
        [mem.npcId]
      );
      
      if (parseInt(existing.rows[0].count) > 0) {
        console.log(`[SKIP] ${mem.npcId}: backstory already exists`);
        continue;
      }
      
      const memoryUuid = generateUuid();
      
      await client.query(`
        INSERT INTO npc_memories (memory_uuid, npc_id, event_type, description, emotional_impact, source_id, trait_effects_json)
        VALUES ($1, $2, $3, $4, $5, 'seed', $6)
      `, [memoryUuid, mem.npcId, mem.eventType, mem.description, mem.emotionalImpact, JSON.stringify(mem.traitEffects)]);
      
      totalSeeded++;
      console.log(`[OK] ${mem.npcId}: seeded backstory memory`);
    } finally {
      client.release();
    }
  }
  
  return totalSeeded;
}

async function fixNames() {
  const client = await pool.connect();
  try {
    await client.query(`UPDATE npc_templates SET name = 'Luca "The Blade"' WHERE npc_id = 'capo'`);
    await client.query(`UPDATE npc_templates SET name = 'Salvatore "The Advisor"' WHERE npc_id = 'consigliere'`);
    console.log('[OK] Fixed NPC names');
  } finally {
    client.release();
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Seeding NPC Social State');
  console.log('='.repeat(50));
  
  await initializeTables();
  await fixNames();
  
  const traitsSeeded = await seedTraits();
  const memoriesSeeded = await seedMemories();
  
  console.log('='.repeat(50));
  console.log(`Seeded ${traitsSeeded} traits, ${memoriesSeeded} memories`);
  
  const client = await pool.connect();
  const traitCount = await client.query(`SELECT COUNT(*) FROM npc_traits`);
  const memoryCount = await client.query(`SELECT COUNT(*) FROM npc_memories`);
  console.log(`Total traits in DB: ${traitCount.rows[0].count}`);
  console.log(`Total memories in DB: ${memoryCount.rows[0].count}`);
  client.release();
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });