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
    // Create tables if they don't exist
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

export { pool };