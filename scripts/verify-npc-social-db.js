// Verification script for NPC Social Simulation
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:mbADBQGytUrPGavlQGvmqfkguJVGSohT@shortline.proxy.rlwy.net:47702/railway';

async function verify() {
  console.log('='.repeat(60));
  console.log('NPC Social Simulation Verification');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  let passed = 0, failed = 0;
  
  try {
    const client = await pool.connect();
    console.log('[OK] Connected to database');
    passed++;

    // npc_traits table
    try {
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'npc_traits'`);
      const has = ['npc_id', 'target_id', 'trait_type', 'value'].every(c => cols.rows.some(r => r.column_name === c));
      if (has) { console.log('[OK] npc_traits table exists with required columns'); passed++; }
      else { console.log('[FAIL] npc_traits missing columns'); failed++; }
    } catch { console.log('[FAIL] npc_traits table missing'); failed++; }

    // npc_memories table  
    try {
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'npc_memories'`);
      const has = ['npc_id', 'event_type', 'description', 'emotional_impact'].every(c => cols.rows.some(r => r.column_name === c));
      if (has) { console.log('[OK] npc_memories table exists with required columns'); passed++; }
      else { console.log('[FAIL] npc_memories missing columns'); failed++; }
    } catch { console.log('[FAIL] npc_memories table missing'); failed++; }

    // npc_templates table check
    try {
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'npc_templates'`);
      const count = await client.query(`SELECT COUNT(*) FROM npc_templates`);
      console.log(`[OK] npc_templates table exists (${count.rows[0].count} templates)`);
      passed++;
    } catch { console.log('[FAIL] npc_templates table missing'); failed++; }

    // Test trait CRUD
    try {
      await client.query(`INSERT INTO npc_traits (npc_id, target_id, target_type, trait_type, value) VALUES ('verify-test', 'verify-player', 'player', 'trust', 75) ON CONFLICT (npc_id, target_id, trait_type) DO UPDATE SET value = 75`);
      const r = await client.query(`SELECT value FROM npc_traits WHERE npc_id = 'verify-test' AND target_id = 'verify-player' AND trait_type = 'trust'`);
      if (r.rows[0]?.value === 75) { console.log('[OK] Trait create/update works'); passed++; }
      else { console.log('[FAIL] Trait CRUD'); failed++; }
      await client.query(`DELETE FROM npc_traits WHERE npc_id = 'verify-test'`);
    } catch (e) { console.log('[FAIL] Trait CRUD:', e.message); failed++; }

    // Test memory CRUD
    try {
      await client.query(`INSERT INTO npc_memories (npc_id, event_type, description, emotional_impact) VALUES ('verify-test', 'test-event', 'Verification test memory', 50)`);
      const r = await client.query(`SELECT description, emotional_impact FROM npc_memories WHERE npc_id = 'verify-test'`);
      if (r.rows[0]?.description === 'Verification test memory') { console.log('[OK] Memory create works'); passed++; }
      else { console.log('[FAIL] Memory CRUD'); failed++; }
      await client.query(`DELETE FROM npc_memories WHERE npc_id = 'verify-test'`);
    } catch (e) { console.log('[FAIL] Memory CRUD:', e.message); failed++; }

    // Check for seeded templates
    try {
      const r = await client.query(`SELECT npc_id, name, role FROM npc_templates WHERE is_active = TRUE`);
      console.log(`[INFO] ${r.rows.length} seeded NPC templates:`);
      for (const row of r.rows) {
        console.log(`     - ${row.npc_id}: ${row.name} (${row.role})`);
      }
    } catch (e) { console.log('[WARN] Could not list templates'); }

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