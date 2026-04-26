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
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50) UNIQUE,
        registered BOOLEAN DEFAULT FALSE,
        family_name VARCHAR(100),
        title VARCHAR(50),
        gender VARCHAR(20),
        sexual_preference VARCHAR(20),
        registered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        code VARCHAR(6) NOT NULL,
        type VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS passkey_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        credential_id VARCHAR(255) UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        device_type VARCHAR(50),
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

// ============ User Authentication ============

export interface User {
  id: number;
  email: string | null;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PasskeyCredential {
  id: string;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string;
  created_at: Date;
}

// Create or get user by email
export async function getOrCreateUserByEmail(email: string): Promise<User> {
  const client = await pool.connect();
  try {
    let result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    result = await client.query(
      'INSERT INTO users (email) VALUES ($1) RETURNING *',
      [email]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Create or get user by phone
export async function getOrCreateUserByPhone(phone: string): Promise<User> {
  const client = await pool.connect();
  try {
    let result = await client.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    result = await client.query(
      'INSERT INTO users (phone) VALUES ($1) RETURNING *',
      [phone]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Get user by ID
export async function getUserById(userId: number): Promise<User | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// Store OTP code
export async function storeOtpCode(userId: number, code: string, type: 'email' | 'sms'): Promise<void> {
  const client = await pool.connect();
  try {
    // Delete any existing OTPs for this user
    await client.query(
      'DELETE FROM otp_codes WHERE user_id = $1',
      [userId]
    );
    
    // Insert new OTP (expires in 10 minutes)
    await client.query(
      'INSERT INTO otp_codes (user_id, code, type, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'10 minutes\')',
      [userId, code, type]
    );
  } finally {
    client.release();
  }
}

// Verify OTP code
export async function verifyOtpCode(userId: number, code: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM otp_codes WHERE user_id = $1 AND code = $2 AND expires_at > NOW()',
      [userId, code]
    );
    
    if (result.rows.length > 0) {
      // Delete the used code
      await client.query(
        'DELETE FROM otp_codes WHERE user_id = $1',
        [userId]
      );
      return true;
    }
    return false;
  } finally {
    client.release();
  }
}

// Store passkey credential
export async function storePasskeyCredential(
  userId: number,
  credentialId: string,
  publicKey: string,
  counter: number,
  deviceType: string
): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if credential already exists
    const existing = await client.query(
      'SELECT * FROM passkey_credentials WHERE credential_id = $1',
      [credentialId]
    );
    
    if (existing.rows.length === 0) {
      await client.query(
        'INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter, device_type) VALUES ($1, $2, $3, $4, $5)',
        [userId, credentialId, publicKey, counter, deviceType]
      );
    }
  } finally {
    client.release();
  }
}

// Get passkey credentials for user
export async function getPasskeyCredentials(userId: number): Promise<PasskeyCredential[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM passkey_credentials WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// Update passkey counter
export async function updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE passkey_credentials SET counter = $1 WHERE credential_id = $2',
      [counter, credentialId]
    );
  } finally {
    client.release();
  }
}

// ============ User Registration ============

export interface UserProfile {
  id: number;
  email: string | null;
  phone: string | null;
  registered: boolean;
  family_name: string | null;
  title: string | null;
  gender: string | null;
  sexual_preference: string | null;
  registered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Check if user is registered
export async function isUserRegistered(email: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT registered FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].registered === true;
  } finally {
    client.release();
  }
}

// Get user profile
export async function getUserProfile(email: string): Promise<UserProfile | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// Complete user registration
export async function completeRegistration(
  email: string,
  familyName: string,
  title: string,
  gender: string,
  sexualPreference: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users SET 
        registered = TRUE,
        family_name = $2,
        title = $3,
        gender = $4,
        sexual_preference = $5,
        registered_at = NOW(),
        updated_at = NOW()
      WHERE email = $1`,
      [email, familyName, title, gender, sexualPreference]
    );
  } finally {
    client.release();
  }
}

// Add phone to existing user
export async function addUserPhone(email: string, phone: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET phone = $2, updated_at = NOW() WHERE email = $1',
      [email, phone]
    );
  } finally {
    client.release();
  }
}

export { pool };