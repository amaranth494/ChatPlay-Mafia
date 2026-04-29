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
      CREATE TABLE IF NOT EXISTS npcs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        npc_id VARCHAR(100) UNIQUE NOT NULL,
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
export async function getUserNpcs(userId: number): Promise<{npcId: string; name: string; role: string; personality: string}[]> {
  const client = await pool.connect();
  try {
    console.log(`[DB] getUserNpcs: userId=${userId}`);
    const result = await client.query(
      'SELECT npc_id, name, role, personality FROM npcs WHERE user_id = $1',
      [userId]
    );
    console.log(`[DB] Found ${result.rows.length} NPCs:`, result.rows.map(r => r.npc_id));
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

export { pool };