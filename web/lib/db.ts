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

// Add migration to ensure all columns exist
async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Check and add columns to users table
    const userColumnsToAdd = [
      { name: 'first_name', type: 'VARCHAR(100)' },
      { name: 'last_name', type: 'VARCHAR(100)' },
      { name: 'verified', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'registered', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'family_name', type: 'VARCHAR(100)' },
      { name: 'title', type: 'VARCHAR(50)' },
      { name: 'gender', type: 'VARCHAR(20)' },
      { name: 'sexual_preference', type: 'VARCHAR(20)' },
      { name: 'registered_at', type: 'TIMESTAMP' },
      { name: 'player_uuid', type: 'VARCHAR(100)' },
    ];
    
    for (const col of userColumnsToAdd) {
      try {
        await client.query(
          `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`
        );
      } catch (e) { /* column might already exist */ }
    }
    
    // Add thread_uuid column to existing threads table
    try {
      await client.query(
        'ALTER TABLE threads ADD COLUMN IF NOT EXISTS thread_uuid VARCHAR(100)'
      );
    } catch (e) { /* column might exist */ }
    
    // Add npc_uuid and player_uuid columns to threads table
    try {
      await client.query(
        'ALTER TABLE threads ADD COLUMN IF NOT EXISTS npc_uuid VARCHAR(100)'
      );
    } catch (e) { /* column might exist */ }
    try {
      await client.query(
        'ALTER TABLE threads ADD COLUMN IF NOT EXISTS player_uuid VARCHAR(100)'
      );
    } catch (e) { /* column might exist */ }
    
    // Make old npc_id and player_id nullable in threads table
    try {
      await client.query('ALTER TABLE threads ALTER COLUMN npc_id DROP NOT NULL');
    } catch (e) { /* may already be nullable */ }
    try {
      await client.query('ALTER TABLE threads ALTER COLUMN player_id DROP NOT NULL');
    } catch (e) { /* may already be nullable */ }
    
    // Add message_uuid and thread_uuid columns to messages table  
    try {
      await client.query(
        'ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_uuid VARCHAR(100)'
      );
    } catch (e) { /* column might exist */ }
    try {
      await client.query(
        'ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_uuid VARCHAR(100)'
      );
    } catch (e) { /* column might exist */ }
    
    // Add npc_id column to npcs table
    try {
      await client.query(
        'ALTER TABLE npcs ADD COLUMN IF NOT EXISTS npc_id VARCHAR(100)'
      );
    } catch (e) { /* column might exist */ }
    
    // Generate player_uuid for existing users that don't have one
    try {
      await client.query(`
        UPDATE users SET player_uuid = '${generateUuid()}' 
        WHERE (player_uuid IS NULL OR player_uuid = '')
      `);
    } catch (e) { /* ignore if already has UUIDs */ }
    
    console.log('[DB] Migrations complete');
  } catch (err) {
    console.error('[DB] Migration error:', err);
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  console.log('[DB] Initializing database tables...');
  
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        player_uuid VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        verified BOOLEAN DEFAULT FALSE,
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
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        thread_uuid VARCHAR(100) UNIQUE NOT NULL,
        npc_uuid VARCHAR(100) NOT NULL,
        player_uuid VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        message_uuid VARCHAR(100) UNIQUE NOT NULL,
        thread_uuid VARCHAR(100) NOT NULL,
        sender VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
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
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS npc_templates (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        personality TEXT,
        backstory TEXT,
        speech_pattern TEXT,
        loyalty_level INTEGER DEFAULT 50,
        influence_level INTEGER DEFAULT 50,
        danger_level INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS npc_traits (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(100) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        trait_type VARCHAR(50) NOT NULL,
        value INTEGER DEFAULT 50,
        last_modified TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(npc_id, target_id, trait_type)
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS npc_memories (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        emotional_impact INTEGER DEFAULT 50,
        source_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS npcs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        npc_id VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        personality TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_state (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(100) UNIQUE NOT NULL,
        day_number INTEGER DEFAULT 1,
        is_day BOOLEAN DEFAULT TRUE,
        total_ticks INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('[DB] Tables created successfully');
    
    // Run migrations
    await runMigrations();
  } catch (err) {
    console.error('[DB] Init error:', err);
  } finally {
    client.release();
  }
}

// Get or create thread for NPC and player using UUIDs
export async function getOrCreateThread(npcUuid: string, playerUuid: string): Promise<string> {
  const client = await pool.connect();
  try {
    console.log(`[DB] getOrCreateThread: npcUuid=${npcUuid}, playerUuid=${playerUuid}`);
    
    let result = await client.query(
      'SELECT thread_uuid FROM threads WHERE npc_uuid = $1 AND player_uuid = $2',
      [npcUuid, playerUuid]
    );
    
    if (result.rows.length > 0) {
      console.log(`[DB] Found existing thread: uuid=${result.rows[0].thread_uuid}`);
      return result.rows[0].thread_uuid;
    }
    
    // Create new thread with UUID - include old column placeholders to satisfy NOT NULL constraints
    const threadUuid = generateUuid();
    console.log(`[DB] Creating new thread: uuid=${threadUuid}`);
    await client.query(
      'INSERT INTO threads (id, thread_uuid, npc_id, npc_uuid, player_id, player_uuid) VALUES ($1, $2, $3, $4, $5, $6)',
      [Date.now() % 100000, threadUuid, npcUuid, npcUuid, playerUuid, playerUuid]
    );
    
    return threadUuid;
  } finally {
    client.release();
  }
}

// Save message to database using UUIDs
export async function saveMessage(threadUuid: string, sender: string, content: string): Promise<void> {
  const client = await pool.connect();
  try {
    console.log(`[DB] saveMessage: threadUuid=${threadUuid}, sender=${sender}, content="${content.substring(0, 30)}..."`);
    await client.query(
      'INSERT INTO messages (message_uuid, thread_uuid, sender, content) VALUES ($1, $2, $3, $4)',
      [generateUuid(), threadUuid, sender, content]
    );
    
    // Update thread's updated_at
    await client.query(
      'UPDATE threads SET updated_at = NOW() WHERE thread_uuid = $1',
      [threadUuid]
    );
    console.log(`[DB] Message saved successfully`);
  } finally {
    client.release();
  }
}

// Get message history for a thread using UUID
export async function getMessageHistory(threadUuid: string, limit: number = 50): Promise<Array<{id: string, sender: string, content: string, timestamp: string}>> {
  const client = await pool.connect();
  try {
    console.log(`[DB] getMessageHistory: threadUuid=${threadUuid}, limit=${limit}`);
    const result = await client.query(
      'SELECT message_uuid, sender, content, created_at as timestamp FROM messages WHERE thread_uuid = $1 ORDER BY created_at ASC LIMIT $2',
      [threadUuid, limit]
    );
    
    const messages = result.rows.map(row => ({
      id: row.message_uuid,
      sender: row.sender,
      content: row.content,
      timestamp: row.timestamp.toISOString()
    }));
    
    console.log(`[DB] Loaded ${messages.length} messages`);
    return messages;
  } finally {
    client.release();
  }
}

// ============ User Authentication ============

export interface User {
  id: number;
  player_uuid: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
  registered: boolean;
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

// Verify OTP code and mark user as verified
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
      // Mark user as verified
      await client.query(
        'UPDATE users SET verified = TRUE WHERE id = $1',
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

// Check if user is registered (verified)
export async function isUserRegistered(email: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT verified FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].verified === true;
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

// Get user by email only (no creation)
export async function getUserByEmail(email: string): Promise<User | null> {
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

// Create new user (for registration)
export async function createUser(email: string, phone: string | null, firstName: string, lastName: string): Promise<number> {
  const client = await pool.connect();
  try {
    const playerUuid = generateUuid();
    console.log(`[DB] createUser: email=${email}, playerUuid=${playerUuid}`);
    const result = await client.query(
      'INSERT INTO users (player_uuid, email, phone, first_name, last_name, verified) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id',
      [playerUuid, email, phone, firstName, lastName]
    );
    console.log(`[DB] Created user: id=${result.rows[0].id}, playerUuid=${playerUuid}`);
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Get user by phone only (no creation)
export async function getUserByPhone(phone: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// Update user profile
interface ProfileUpdate {
  phone?: string;
  firstName?: string;
  lastName?: string;
  familyName?: string;
  title?: string;
  gender?: string;
  sexualPreference?: string;
}

export async function updateUserProfile(email: string, updates: ProfileUpdate): Promise<void> {
  const client = await pool.connect();
  try {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [email];
    let paramIndex = 2;

    if (updates.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(updates.phone || null);
    }
    if (updates.firstName !== undefined) {
      setClauses.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName || null);
    }
    if (updates.lastName !== undefined) {
      setClauses.push(`last_name = $${paramIndex++}`);
      values.push(updates.lastName || null);
    }
    if (updates.familyName !== undefined) {
      setClauses.push(`family_name = $${paramIndex++}`);
      values.push(updates.familyName || null);
    }
    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title || null);
    }
    if (updates.gender !== undefined) {
      setClauses.push(`gender = $${paramIndex++}`);
      values.push(updates.gender || null);
    }
    if (updates.sexualPreference !== undefined) {
      setClauses.push(`sexual_preference = $${paramIndex++}`);
      values.push(updates.sexualPreference || null);
    }

    await client.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE email = $1`,
      values
    );
  } finally {
    client.release();
  }
}

// Check if user has NPCs generated
export async function checkUserHasNpcs(userId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT COUNT(*) FROM npcs WHERE user_id = $1',
      [userId]
    );
    return result.rows[0].count > 0;
  } finally {
    client.release();
  }
}

// Generate a UUID
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate random NPCs for user
export async function generateNpcsForUser(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if already has NPCs - delete and regenerate with new UUIDs
    await client.query('DELETE FROM npcs WHERE user_id = $1', [userId]);
    console.log(`[DB] Cleared existing NPCs for user ${userId}`);

    const consigliereNames = [
      'Salvatore "The Advisor"',
      'Giuseppe "Wise"',
      'Antonio "Old Man"',
      'Francesco " Counselor"',
      'Marco "Strategic"'
    ];
    
    const lieutenantNames = [
      'Luca "The Blade"',
      'Rico "Muscles"',
      'Vinnie "拳"',
      'Gino "Quick"',
      'Tony "Guns"',
      'Sal "Connections"',
      'Paulie "Deal Maker"',
      'Jimmy "Smooth"'
    ];

    const personalities = [
      'Loyal but cautious. Speaks only when necessary.',
      'Ambitious and always looking for opportunity.',
      'Old school, values respect and tradition.',
      'Quick-tempered but capable.',
      'Calculating, thinks three moves ahead.',
      'Flashy, loves living large.',
      'Quiet and mysterious.',
      'Aggressive, always ready for action.'
    ];

    // Pick random consigliere
    const consigliereName = consigliereNames[Math.floor(Math.random() * consigliereNames.length)];
    const consiglierePersonality = personalities[Math.floor(Math.random() * personalities.length)];
    const consigliereUuid = generateUuid();
    
    // Pick random lieutenant (different from consigliere)
    const lieutenantName = lieutenantNames[Math.floor(Math.random() * lieutenantNames.length)];
    const lieutenantPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    const lieutenantUuid = generateUuid();

    // Insert NPCs with UUIDs
    await client.query(
      'INSERT INTO npcs (user_id, npc_id, name, role, personality) VALUES ($1, $2, $3, $4, $5)',
      [userId, consigliereUuid, consigliereName, 'consiglieri', consiglierePersonality]
    );
    
    await client.query(
      'INSERT INTO npcs (user_id, npc_id, name, role, personality) VALUES ($1, $2, $3, $4, $5)',
      [userId, lieutenantUuid, lieutenantName, 'capo', lieutenantPersonality]
    );

    console.log(`[DB] Generated NPCs for user ${userId}: ${consigliereUuid} (${consigliereName}), ${lieutenantUuid} (${lieutenantName})`);
  } finally {
    client.release();
  }
}

// Get NPCs for user
export async function getNpcByUuid(npcUuid: string): Promise<{npcId: string; name: string; role: string; personality: string} | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT npc_id AS "npcId", name, role, personality FROM npcs WHERE npc_id = $1',
      [npcUuid]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getUserNpcs(userId: number): Promise<{npcId: string; name: string; role: string; personality: string}[]> {
  const client = await pool.connect();
  try {
    console.log(`[DB] getUserNpcs: userId=${userId}`);
    const result = await client.query(
      'SELECT npc_id AS "npcId", name, role, personality FROM npcs WHERE user_id = $1',
      [userId]
    );
    console.log(`[DB] Found ${result.rows.length} NPCs:`, result.rows.map(r => r.npcId));
    return result.rows;
  } finally {
    client.release();
  }
}

// Clear family info (keep user, remove NPCs, threads, messages)
export async function clearFamilyInfo(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    // Get player_uuid first
    const userResult = await client.query('SELECT player_uuid FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return;
    
    const playerUuid = userResult.rows[0].player_uuid;
    console.log(`[DB] clearFamilyInfo: playerUuid=${playerUuid}`);
    
    // Delete messages for threads owned by this player
    await client.query(
      'DELETE FROM messages WHERE thread_uuid IN (SELECT thread_uuid FROM threads WHERE player_uuid = $1)',
      [playerUuid]
    );
    
    // Delete threads for this player
    await client.query('DELETE FROM threads WHERE player_uuid = $1', [playerUuid]);
    
    // Delete NPCs
    await client.query('DELETE FROM npcs WHERE user_id = $1', [userId]);
    
    // Clear family info fields
    await client.query(
      'UPDATE users SET family_name = NULL, title = NULL, gender = NULL, sexual_preference = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    console.log(`[DB] Cleared family info for user ${userId} (playerUuid=${playerUuid})`);
  } finally {
    client.release();
  }
}

// Delete user and all associated data
export async function deleteUser(email: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Get user ID first
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return;
    
    const userId = userResult.rows[0].id;

    // Delete NPCs
    await client.query('DELETE FROM npcs WHERE user_id = $1', [userId]);

    // Delete messages from user's threads
    await client.query(
      'DELETE FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE player_id = $1)',
      [`user_${userId}`]
    );

    // Delete threads
    await client.query('DELETE FROM threads WHERE player_id = $1', [`user_${userId}`]);

    // Delete passkey credentials
    await client.query('DELETE FROM passkey_credentials WHERE user_id = $1', [userId]);

    // Delete OTP codes
    await client.query('DELETE FROM otp_codes WHERE user_id = $1', [userId]);

    // Delete user
    await client.query('DELETE FROM users WHERE email = $1', [email]);

    console.log(`[DB] Deleted user and all data for: ${email}`);
  } finally {
    client.release();
  }
}

export interface GameStateRow {
  id: number;
  game_id: string;
  day_number: number;
  is_day: boolean;
  total_ticks: number;
  created_at: Date;
  updated_at: Date;
}

export async function getGameState(gameId: string = 'default'): Promise<GameStateRow | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM game_state WHERE game_id = $1',
      [gameId]
    );
    if (result.rows.length === 0) return null;
    return {
      id: result.rows[0].id,
      game_id: result.rows[0].game_id,
      day_number: result.rows[0].day_number,
      is_day: result.rows[0].is_day,
      total_ticks: result.rows[0].total_ticks,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };
  } finally {
    client.release();
  }
}

export async function createGameState(gameId: string = 'default'): Promise<GameStateRow> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO game_state (game_id, day_number, is_day, total_ticks) VALUES ($1, 1, TRUE, 0) RETURNING *',
      [gameId]
    );
    return {
      id: result.rows[0].id,
      game_id: result.rows[0].game_id,
      day_number: result.rows[0].day_number,
      is_day: result.rows[0].is_day,
      total_ticks: result.rows[0].total_ticks,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };
  } finally {
    client.release();
  }
}

export async function updateGameState(
  gameId: string,
  dayNumber: number,
  isDay: boolean,
  totalTicks: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE game_state SET day_number = $2, is_day = $3, total_ticks = $4, updated_at = NOW() WHERE game_id = $1',
      [gameId, dayNumber, isDay, totalTicks]
    );
  } finally {
    client.release();
  }
}

export async function resetGameState(gameId: string = 'default'): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE game_state SET day_number = 1, is_day = TRUE, total_ticks = 0, updated_at = NOW() WHERE game_id = $1',
      [gameId]
    );
    console.log(`[DB] Game state reset for: ${gameId}`);
  } finally {
    client.release();
  }
}

export interface NpcTemplate {
  id: number;
  npc_id: string;
  role: string;
  name: string;
  personality: string | null;
  backstory: string | null;
  speech_pattern: string | null;
  loyalty_level: number;
  influence_level: number;
  danger_level: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function getNpcTemplates(): Promise<NpcTemplate[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM npc_templates WHERE is_active = TRUE ORDER BY role, name'
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getNpcTemplate(npcId: string): Promise<NpcTemplate | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM npc_templates WHERE npc_id = $1 AND is_active = TRUE',
      [npcId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function createNpcTemplate(
  npcId: string,
  role: string,
  name: string,
  personality?: string,
  backstory?: string,
  speechPattern?: string,
  loyaltyLevel?: number,
  influenceLevel?: number,
  dangerLevel?: number
): Promise<NpcTemplate> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO npc_templates (npc_id, role, name, personality, backstory, speech_pattern, loyalty_level, influence_level, danger_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [npcId, role, name, personality || null, backstory || null, speechPattern || null, loyaltyLevel || 50, influenceLevel || 50, dangerLevel || 50]
    );
    console.log(`[DB] Created NPC template: ${name} (${role})`);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateNpcTemplate(
  npcId: string,
  updates: Partial<{
    name: string;
    personality: string;
    backstory: string;
    speech_pattern: string;
    loyalty_level: number;
    influence_level: number;
    danger_level: number;
    is_active: boolean;
  }>
): Promise<void> {
  const client = await pool.connect();
  try {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.personality !== undefined) {
      setClauses.push(`personality = $${paramIndex++}`);
      values.push(updates.personality);
    }
    if (updates.backstory !== undefined) {
      setClauses.push(`backstory = $${paramIndex++}`);
      values.push(updates.backstory);
    }
    if (updates.speech_pattern !== undefined) {
      setClauses.push(`speech_pattern = $${paramIndex++}`);
      values.push(updates.speech_pattern);
    }
    if (updates.loyalty_level !== undefined) {
      setClauses.push(`loyalty_level = $${paramIndex++}`);
      values.push(updates.loyalty_level);
    }
    if (updates.influence_level !== undefined) {
      setClauses.push(`influence_level = $${paramIndex++}`);
      values.push(updates.influence_level);
    }
    if (updates.danger_level !== undefined) {
      setClauses.push(`danger_level = $${paramIndex++}`);
      values.push(updates.danger_level);
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }
    
    if (setClauses.length === 0) return;
    
    setClauses.push(`updated_at = NOW()`);
    values.push(npcId);
    
    await client.query(
      `UPDATE npc_templates SET ${setClauses.join(', ')} WHERE npc_id = $${paramIndex}`,
      values
    );
    console.log(`[DB] Updated NPC template: ${npcId}`);
  } finally {
    client.release();
  }
}

export async function seedDefaultNpcTemplates(): Promise<void> {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM npc_templates');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('[DB] NPC templates already exist, skipping seed');
      return;
    }
    
    const templates = [
      { npcId: 'consiglieri', role: 'Consigliere', name: 'Salvatore "The Advisor"', personality: 'Wise and calculating. Speaks only when necessary, always thinking three moves ahead.', backstory: 'Former lawyer who became the family\'s most trusted advisor after saving the Boss from a rival ambush.', speechPattern: 'Measured, formal, uses short sentences.' },
      { npcId: 'lieutenant', role: 'Lieutenant', name: 'Luca "The Blade"', personality: 'Violent and unpredictable. Short-tempered but fiercely loyal.', backstory: 'Former boxer who worked his way up through the ranks using his fists.', speechPattern: 'Blunt, aggressive, minimal words.' },
      { npcId: 'soldier', role: 'Soldier', name: 'Marco', personality: 'Nervous and eager to please. New to the family but ambitious.', backstory: 'Young recruit from the old neighborhood, looking for a way up.', speechPattern: 'Formal, overly respectful, often nervous.' }
    ];
    
    for (const t of templates) {
      await client.query(
        `INSERT INTO npc_templates (npc_id, role, name, personality, backstory, speech_pattern) VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.npcId, t.role, t.name, t.personality, t.backstory, t.speechPattern]
      );
    }
    
    console.log('[DB] Seeded 3 default NPC templates');
  } finally {
    client.release();
  }
}

export { pool };

// ============ NPC Social Simulation ============

// NPC Traits table - tracks emotional relationships between NPCs and targets
export async function createNpcTraitsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS npc_traits (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(100) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        trait_type VARCHAR(50) NOT NULL,
        value INTEGER DEFAULT 50,
        last_modified TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(npc_id, target_id, trait_type)
      );
    `);
    console.log('[DB] npc_traits table ready');
  } finally {
    client.release();
  }
}

// NPC Memories table - stores event-based memories with emotional context
export async function createNpcMemoriesTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS npc_memories (
        id SERIAL PRIMARY KEY,
        npc_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        emotional_impact INTEGER DEFAULT 50,
        source_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
    `);
    console.log('[DB] npc_memories table ready');
  } finally {
    client.release();
  }
}

// Set NPC trait value (create or update)
export async function setNpcTrait(
  npcId: string,
  targetId: string,
  targetType: string,
  traitType: string,
  value: number
): Promise<void> {
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

// Get all traits for an NPC
export async function getNpcTraits(npcId: string): Promise<Array<{
  targetId: string;
  targetType: string;
  traitType: string;
  value: number;
}>> {
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

// Add NPC memory
export async function addNpcMemory(
  npcId: string,
  eventType: string,
  description: string,
  emotionalImpact: number,
  sourceId?: string,
  expiresInDays?: number
): Promise<void> {
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

// Get active memories for NPC
export async function getNpcMemories(npcId: string): Promise<Array<{
  eventType: string;
  description: string;
  emotionalImpact: number;
  sourceId: string | null;
}>> {
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

// Decay all NPC traits (called every game tick)
export async function decayNpcTraits(decayRate: number = 1): Promise<number> {
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

// Process memory-to-trait causation
export async function processMemoryCausation(): Promise<number> {
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

// Calculate NPC emotional state from traits and memories
export async function calculateEmotionalState(npcId: string): Promise<{
  emotion: string;
  intensity: number;
  context: string;
}> {
  const traits = await getNpcTraits(npcId);
  const memories = await getNpcMemories(npcId);
  
  let trust = 0, fear = 0, anger = 0, loyalty = 0;
  for (const t of traits) {
    if (t.traitType === 'trust') trust += t.value;
    else if (t.traitType === 'fear') fear += t.value;
    else if (t.traitType === 'anger') anger += t.value;
    else if (t.traitType === 'loyalty') loyalty += t.value;
  }
  
  const recentImpact = memories.slice(0, 5).reduce((sum, m) => sum + m.emotionalImpact, 0);
  
  const emotions = [
    { name: 'wary', score: Math.abs(fear) + Math.abs(trust) / 2 },
    { name: 'hostile', score: anger + Math.abs(recentImpact) },
    { name: 'loyal', score: loyalty },
    { name: 'trusting', score: trust },
    { name: 'paranoid', score: fear }
  ].sort((a, b) => b.score - a.score)[0];
  
  const intensity = Math.min(100, Math.abs(emotions.score) + Math.abs(recentImpact) / 10);
  let context = `They seem ${emotions.name}.`;
  if (recentImpact > 20) context = `Recently troubled. ${context}`;
  else if (recentImpact < -20) context = `Feeling grateful. ${context}`;
  
  return { emotion: emotions.name, intensity: Math.round(intensity), context };
}