// Verification script for NPC Social Simulation
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function verify() {
  console.log('='.repeat(60));
  console.log('NPC Social Simulation Verification');
  console.log('='.repeat(60));
  
  if (!DATABASE_URL) {
    console.log('[FATAL] DATABASE_URL not set');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
  });

  let passed = 0, failed = 0;
  
  try {
    const client = await pool.connect();
    console.log('[OK] Connected');
    passed++;

    // npc_traits table
    try {
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'npc_traits'`);
      const has = ['npc_id', 'target_id', 'trait_type', 'value'].every(c => cols.rows.some(r => r.column_name === c));
      if (has) { console.log('[OK] npc_traits table'); passed++; }
      else { console.log('[FAIL] npc_traits missing columns'); failed++; }
    } catch { console.log('[FAIL] npc_traits table missing'); failed++; }

    // npc_memories table  
    try {
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'npc_memories'`);
      const has = ['npc_id', 'event_type', 'description', 'emotional_impact'].every(c => cols.rows.some(r => r.column_name === c));
      if (has) { console.log('[OK] npc_memories table'); passed++; }
      else { console.log('[FAIL] npc_memories missing columns'); failed++; }
    } catch { console.log('[FAIL] npc_memories table missing'); failed++; }

    // Test trait CRUD
    try {
      await client.query(`INSERT INTO npc_traits (npc_id, target_id, target_type, trait_type, value) VALUES ('test', 'test', 'player', 'trust', 75) ON CONFLICT DO NOTHING`);
      const r = await client.query(`SELECT value FROM npc_traits WHERE npc_id = 'test' AND target_id = 'test'`);
      if (r.rows[0]?.value === 75) { console.log('[OK] Trait CRUD'); passed++; }
      else { console.log('[FAIL] Trait CRUD'); failed++; }
      await client.query(`DELETE FROM npc_traits WHERE npc_id = 'test'`);
    } catch (e) { console.log('[FAIL] Trait CRUD:', e.message); failed++; }

    // Test memory CRUD
    try {
      await client.query(`INSERT INTO npc_memories (npc_id, event_type, description, emotional_impact) VALUES ('test', 'test', 'test', 50)`);
      const r = await client.query(`SELECT description FROM npc_memories WHERE npc_id = 'test'`);
      if (r.rows[0]?.description === 'test') { console.log('[OK] Memory CRUD'); passed++; }
      else { console.log('[FAIL] Memory CRUD'); failed++; }
      await client.query(`DELETE FROM npc_memories WHERE npc_id = 'test'`);
    } catch (e) { console.log('[FAIL] Memory CRUD:', e.message); failed++; }

    client.release();
  } catch (e) {
    console.log('[FATAL]', e.message);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('='.repeat(60));
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

verify();