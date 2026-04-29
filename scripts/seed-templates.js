const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:mbADBQGytUrPGavlQGvmqfkguJVGSohT@shortline.proxy.rlwy.net:47702/railway',
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  const client = await pool.connect();
  
  const templates = [
    { npcId: 'consigliere', role: 'Consigliere', name: 'Salvatore "The Advisor"', personality: 'Wise and calculating. Speaks only when necessary.', backstory: 'Former lawyer who saved the Boss from an ambush.', speechPattern: 'Measured, formal sentences.', loyalty: 70, influence: 80, danger: 30 },
    { npcId: 'capo', role: 'Capo', name: 'Luca "The Blade"', personality: 'Violent but loyal. Short-tempered.', backstory: 'Rose through the ranks as an enforcer.', speechPattern: 'Blunt, aggressive.', loyalty: 60, influence: 50, danger: 90 },
    { npcId: 'soldier', role: 'Soldier', name: 'Marco', personality: 'Nervous but ambitious.', backstory: 'New recruit from the old neighborhood.', speechPattern: 'Formal, overly respectful.', loyalty: 40, influence: 20, danger: 50 }
  ];

  for (const t of templates) {
    try {
      await client.query(
        `INSERT INTO npc_templates (npc_id, role, name, personality, backstory, speech_pattern, loyalty_level, influence_level, danger_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (npc_id) DO NOTHING`,
        [t.npcId, t.role, t.name, t.personality, t.backstory, t.speechPattern, t.loyalty, t.influence, t.danger]
      );
      console.log(`[OK] Seeded ${t.name}`);
    } catch (e) {
      console.log(`[WARN] ${t.npcId}: ${e.message}`);
    }
  }

  const result = await client.query('SELECT npc_id, name, role, loyalty_level, influence_level, danger_level FROM npc_templates');
  console.log('\n=== Seeded NPC Templates ===');
  for (const row of result.rows) {
    console.log(`${row.npc_id}: ${row.name} (${row.role}) - Loyalty: ${row.loyalty_level}, Influence: ${row.influence_level}, Danger: ${row.danger_level}`);
  }

  client.release();
  await pool.end();
}

seed().catch(console.error);