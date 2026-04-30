const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const pool = new Pool({
  connectionString: 'postgresql://postgres:mbADBQGytUrPGavlQGvmqfkguJVGSohT@shortline.proxy.rlwy.net:47702/railway',
  ssl: { rejectUnauthorized: false }
});

async function exportNPCData() {
  const client = await pool.connect();
  
  // Get all NPC templates
  const templates = await client.query(`
    SELECT npc_id, role, name, personality, backstory, speech_pattern, 
           loyalty_level, influence_level, danger_level, is_active, created_at
    FROM npc_templates ORDER BY role, name
  `);
  
  // Get all NPC traits
  const traits = await client.query(`
    SELECT npc_id, target_id, target_type, trait_id, intensity, source_type, source_id, last_modified
    FROM npc_traits ORDER BY npc_id, target_type, intensity DESC
  `);
  
  // Get all NPC memories
  const memories = await client.query(`
    SELECT memory_uuid, npc_id, event_type, description, emotional_impact, source_id, trait_effects_json, created_at, expires_at
    FROM npc_memories ORDER BY created_at DESC
  `);

  client.release();
  await pool.end();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Export templates to CSV
  const templateHeaders = ['npc_id', 'role', 'name', 'personality', 'backstory', 'speech_pattern', 'loyalty_level', 'influence_level', 'danger_level', 'is_active', 'created_at'];
  const templateRows = templates.rows.map(t => [
    t.npc_id,
    t.role,
    t.name || '',
    (t.personality || '').replace(/"/g, '""'),
    (t.backstory || '').replace(/"/g, '""'),
    (t.speech_pattern || '').replace(/"/g, '""'),
    t.loyalty_level,
    t.influence_level,
    t.danger_level,
    t.is_active,
    t.created_at || ''
  ].map(v => `"${v}"`).join(','));
  
  const templateCsv = [templateHeaders.join(','), ...templateRows].join('\n');
  fs.writeFileSync(path.join(REPORTS_DIR, `npc_templates_${timestamp}.csv`), templateCsv);
  console.log(`[OK] Exported npc_templates (${templates.rows.length} rows)`);
  
  // Export traits to CSV
  const traitHeaders = ['npc_id', 'target_type', 'target_id', 'trait_id', 'intensity', 'source_type', 'source_id', 'last_modified'];
  const traitRows = traits.rows.map(t => [
    t.npc_id,
    t.target_type,
    t.target_id,
    t.trait_id,
    t.intensity,
    t.source_type,
    t.source_id,
    t.last_modified || ''
  ].map(v => `"${v || ''}"`).join(','));
  
  const traitCsv = [traitHeaders.join(','), ...traitRows].join('\n');
  fs.writeFileSync(path.join(REPORTS_DIR, `npc_traits_${timestamp}.csv`), traitCsv);
  console.log(`[OK] Exported npc_traits (${traits.rows.length} rows)`);
  
  // Export memories to CSV
  const memoryHeaders = ['memory_uuid', 'npc_id', 'event_type', 'description', 'emotional_impact', 'source_id', 'trait_effects_json', 'created_at', 'expires_at'];
  const memoryRows = memories.rows.map(m => [
    m.memory_uuid,
    m.npc_id,
    m.event_type,
    m.description.replace(/"/g, '""'),
    m.emotional_impact,
    m.source_id || '',
    m.trait_effects_json || '',
    m.created_at || '',
    m.expires_at || ''
  ].map(v => `"${v || ''}"`).join(','));
  
  const memoryCsv = [memoryHeaders.join(','), ...memoryRows].join('\n');
  fs.writeFileSync(path.join(REPORTS_DIR, `npc_memories_${timestamp}.csv`), memoryCsv);
  console.log(`[OK] Exported npc_memories (${memories.rows.length} rows)`);
  
  console.log(`\n=== Files Created in reports/ ===`);
  console.log(`npc_templates_${timestamp}.csv`);
  console.log(`npc_traits_${timestamp}.csv`);
  console.log(`npc_memories_${timestamp}.csv`);
}

exportNPCData().catch(e => { console.error(e); process.exit(1); });