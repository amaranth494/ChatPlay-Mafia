// Test script to validate database schema and API calls
const { Client } = require('pg');

const POSTGRES_URL = 'postgresql://postgres:mbADBQGYTUrPGavlQGvmqfkguJVGSohT@shortline.proxy.rlwy.net:47702/railway';

async function testDatabase() {
  console.log('=== Testing Database Schema ===\n');
  
  const client = new Client({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('[OK] Connected to PostgreSQL');
    
    // Check threads table structure
    console.log('\n--- threads table ---');
    const threadCols = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'threads'
    `);
    console.log('Columns:', threadCols.rows.map(c => `${c.column_name} (${c.is_nullable})`).join(', '));
    
    // Check messages table structure  
    console.log('\n--- messages table ---');
    const msgCols = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
    `);
    console.log('Columns:', msgCols.rows.map(c => `${c.column_name} (${c.is_nullable})`).join(', '));
    
    // Check users table structure
    console.log('\n--- users table ---');
    const userCols = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('Columns:', userCols.rows.map(c => `${c.column_name} (${c.is_nullable})`).join(', '));
    
    // Check npcs table structure
    console.log('\n--- npcs table ---');
    const npcCols = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'npcs'
    `);
    console.log('Columns:', npcCols.rows.map(c => `${c.column_name} (${c.is_nullable})`).join(', '));
    
    // Test thread creation with UUIDs
    console.log('\n=== Testing Thread Operations ===\n');
    
    const testThreadUuid = 'test-' + Date.now();
    const testNpcUuid = 'npc-test-123';
    const testPlayerUuid = 'player-test-456';
    
    try {
      // Try to insert a new thread with UUID columns only
      await client.query(`
        INSERT INTO threads (thread_uuid, npc_uuid, player_uuid) 
        VALUES ($1, $2, $3)
      `, [testThreadUuid, testNpcUuid, testPlayerUuid]);
      console.log(`[OK] Created thread: ${testThreadUuid}`);
      
      // Clean up test thread
      await client.query('DELETE FROM threads WHERE thread_uuid = $1', [testThreadUuid]);
      console.log(`[OK] Deleted test thread`);
    } catch (e) {
      console.log(`[FAIL] Thread creation: ${e.message}`);
    }
    
    // Test message creation with UUIDs
    console.log('\n=== Testing Message Operations ===\n');
    
    try {
      // First create a thread
      await client.query(`
        INSERT INTO threads (thread_uuid, npc_uuid, player_uuid) 
        VALUES ($1, $2, $3)
      `, [testThreadUuid, testNpcUuid, testPlayerUuid]);
      
      // Try to insert a message
      const testMsgUuid = 'msg-test-' + Date.now();
      await client.query(`
        INSERT INTO messages (message_uuid, thread_uuid, sender, content) 
        VALUES ($1, $2, $3, $4)
      `, [testMsgUuid, testThreadUuid, 'player', 'Hello test']);
      console.log(`[OK] Created message: ${testMsgUuid}`);
      
      // Clean up
      await client.query('DELETE FROM messages WHERE message_uuid = $1', [testMsgUuid]);
      await client.query('DELETE FROM threads WHERE thread_uuid = $1', [testThreadUuid]);
      console.log(`[OK] Deleted test message and thread`);
    } catch (e) {
      console.log(`[FAIL] Message creation: ${e.message}`);
    }
    
    // Check existing data
    console.log('\n=== Checking Existing Data ===\n');
    
    const threads = await client.query('SELECT * FROM threads LIMIT 3');
    console.log(`Threads: ${threads.rowCount} rows`);
    if (threads.rowCount > 0) {
      console.log('Sample:', JSON.stringify(threads.rows[0], null, 2));
    }
    
  } catch (e) {
    console.error('[ERROR]', e.message);
  } finally {
    await client.end();
  }
}

testDatabase();