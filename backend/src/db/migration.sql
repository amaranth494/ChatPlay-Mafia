-- Migration: 001_initial_schema.sql
-- ChatPlay Mafia - Initial database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    family_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Families table
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    money INTEGER DEFAULT 100000,
    income_rate INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- NPCs table
CREATE TABLE npcs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('consiglieri', 'capo', 'soldier', 'associate')),
    health VARCHAR(50) DEFAULT 'healthy' CHECK (health IN ('healthy', 'wounded', 'dead')),
    loyalty INTEGER DEFAULT 50 CHECK (loyalty >= 0 AND loyalty <= 100),
    personality TEXT,
    skills JSONB DEFAULT '{}',
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Relationships table
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id),
    npc_id UUID NOT NULL REFERENCES NPCs(id),
    target_npc_id UUID REFERENCES NPCs(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('npc_to_player', 'npc_to_npc')),
    value INTEGER DEFAULT 0 CHECK (value >= -100 AND value <= 100)
);

-- Missions table
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id),
    npc_id UUID NOT NULL REFERENCES NPCs(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 5 CHECK (difficulty >= 1 AND difficulty <= 10),
    potential_reward INTEGER DEFAULT 10000,
    potential_penalty INTEGER DEFAULT 5000,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    outcome VARCHAR(50),
    result_money INTEGER,
    result_injury BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Territories table
CREATE TABLE territories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id),
    name VARCHAR(255) NOT NULL,
    income_generated INTEGER DEFAULT 500,
    risk_level INTEGER DEFAULT 3 CHECK (risk_level >= 1 AND risk_level <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Threads table
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id),
    npc_id UUID NOT NULL REFERENCES NPCs(id),
    is_archive BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unread_count INTEGER DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id),
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('player', 'npc')),
    sender_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN DEFAULT FALSE
);

-- Game events table (for AI context)
CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('mission_complete', 'npc_death', 'npc_joined', 'territory_gained', 'territory_lost')),
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Moderation logs table
CREATE TABLE moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id),
    content TEXT NOT NULL,
    direction VARCHAR(20) CHECK (direction IN ('input', 'output')),
    flagged BOOLEAN DEFAULT FALSE,
    categories JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_npcs_family ON npcs(family_id);
CREATE INDEX idx_missions_family ON missions(family_id);
CREATE INDEX idx_threads_player ON threads(player_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_game_events_family ON game_events(family_id);
CREATE INDEX idx_moderation_logs_created ON moderation_logs(created_at);