import { Pool } from 'pg';

console.log('[DB] Configuring database connection...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('[DB] Connected to database!');
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    client.release();
    console.log('[DB] Query result:', result.rows[0]);
    return true;
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    return false;
  }
}

export async function initDatabase(): Promise<void> {
  console.log('[DB] Initializing database tables...');
  
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(100) NOT NULL,
        player_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER REFERENCES threads(id),
        sender VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('[DB] Tables created successfully');
  } catch (err) {
    console.error('[DB] Init error:', err);
  } finally {
    client.release();
  }
}

// Get or create thread for NPC and player
export async function getOrCreateThread(npcId: string, playerId: string): Promise<number> {
  const client = await pool.connect();
  try {
    let result = await client.query(
      'SELECT id FROM threads WHERE npc_id = $1 AND player_id = $2',
      [npcId, playerId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    result = await client.query(
      'INSERT INTO threads (npc_id, player_id) VALUES ($1, $2) RETURNING id',
      [npcId, playerId]
    );
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Save message to database
export async function saveMessage(threadId: number, sender: string, content: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO messages (thread_id, sender, content) VALUES ($1, $2, $3)',
      [threadId, sender, content]
    );
    
    await client.query(
      'UPDATE threads SET updated_at = NOW() WHERE id = $1',
      [threadId]
    );
  } finally {
    client.release();
  }
}

// Get message history for a thread
export async function getMessageHistory(threadId: number, limit: number = 50): Promise<Array<{id: string, sender: string, content: string, timestamp: string}>> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, sender, content, created_at as timestamp FROM messages WHERE thread_id = $1 ORDER BY created_at ASC LIMIT $2',
      [threadId, limit]
    );
    
    return result.rows.map(row => ({
      id: `msg_${row.id}`,
      sender: row.sender,
      content: row.content,
      timestamp: row.timestamp.toISOString()
    }));
  } finally {
    client.release();
  }
}

export { pool };