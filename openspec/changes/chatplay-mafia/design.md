## Context

ChatPlay Mafia is a single-player conversation-first mafia family management game. The player runs a crime organization entirely through message threads with NPCs—they never act directly, only through persuasion, delegation, and manipulation via chat.

The system has two core layers:
- **Simulation Layer**: Server-authoritative source of truth for money, territory, relationships, missions, injuries, death, succession. Written as deterministic game logic.
- **AI Layer**: Renders how each NPC expresses what they know. Uses OpenAI Responses API to generate dialogue. Does NOT decide what is true—only how truth is expressed.

The web client presents a diegetic messaging experience—no dashboards, no stats panels, just message threads like a private correspondence tool.

## Goals / Non-Goals

**Goals:**
- Deliver a fully playable single-player mafia simulation through chat
- Create server-authoritative game logic that is testable, tunable, and consistent
- Build AI-driven NPC dialogue that feels emotionally complex and alive
- Provide web-based diegetic messaging client as the primary interface
- Separate simulation (truth) from dialogue generation (expression)

**Non-Goals:**
- Multiplayer gameplay (Phase 2+)
- Mobile client (Phase 2+)
- Multiple game genres (just Mafia for now)
- Real-time PvP or leaderboards

## Decisions

### D1: Architecture Separation - Simulation vs Dialogue

**Decision:** Strictly separate game simulation (Node.js service) from NPC dialogue generation (AI orchestrator).

**Rationale:** The proposal explicitly requires this separation. It keeps the game testable and tunable—if an NPC behaves incorrectly, we can fix the prompt without changing game logic. If a mission outcome is wrong, we fix simulation without touching AI.

**Alternatives Considered:**
- Unified service: One process handles both simulation and AI. Rejected—it couples truth-deciding with expression-deciding, making debugging harder.
- AI decides everything: Let the LLM drive game logic. Rejected—non-deterministic, hard to test, can't guarantee consistent game rules.

### D2: WebSocket for Real-Time Messaging

**Decision:** Use WebSockets (Socket.io or raw) for real-time message delivery between client and server.

**Rationale:** Chat feels broken without instant delivery. Polling is wasteful and slow. WebSockets provide the instant, bidirectional communication needed for immersive messaging.

**Alternatives Considered:**
- HTTP polling: Simple but slow and wasteful.
- Server-Sent Events: One-directional (server to client). Would need separate HTTP for client→server. WebSockets handle both.

### D3: PostgreSQL + Redis Stack

**Decision:** PostgreSQL for persistent game data (players, NPCs, missions, relationships). Redis for sessions, caching, and pub/sub for WebSocket coordination.

**Rationale:** Structured data with relationships (NPC↔mission↔territory) fits relational model. Redis handles the high-frequency, transient data (session state, message queue, WebSocket pub/sub).

**Alternatives Considered:**
- NoSQL (MongoDB): Less structure, harder to enforce relationships between NPCs, money, territories.
- SQLite: Fine for development, but Railway's PostgreSQL is production-ready.

### D4: OpenAI Responses API

**Decision:** Use OpenAI Responses API (not Chat Completions) for NPC dialogue generation.

**Rationale:** The prompt explicitly recommends Responses for stateful conversations. It handles conversation context better than raw Chat Completions.

**Alternatives Considered:**
- Chat Completions: Would need manual context management. More work.
- Fine-tuned model: Overkill for MVP. Standard model with good prompts suffices.

### D5: Railway for Initial Hosting

**Decision:** Deploy all services (web app, API, PostgreSQL, Redis) to Railway.

**Rationale:** Fastest path to production. Railway supports all required components with managed primitives. CLI enables quick deploy-test cycles.

**Alternatives Considered:**
- Vercel + Supabase + Upstash: Possible but more fragmented.
- Self-hosted: Too much ops work for MVP.

## Risks / Trade-offs

**[R1] AI costs can scale unpredictably**
→ Each NPC message is an API call. Mitigate with: prompt caching, shorter context windows, rate limiting NPC responses per minute.

**[R2] NPC personality consistency across sessions**
→ If player returns later, NPCs should remember past events. Mitigate with: structured memory in database, injected context on each AI call.

**[R3] Player intent parsing ambiguity**
→ Natural language is ambiguous. Player says "handle it" - what does that mean? Mitigate with: explicit command parsing (/mission, /promote), fallback to Consiglieri for clarification.

**[R4] Moderation false positives**
→ AI might block benign content, or fail to catch harmful content. Mitigate with: OpenAI moderation endpoint on both input and output, manual review queue for borderline cases.

**[R5] Diegetic UI limits information**
→ By design, no stats/dashboards. Player might feel in the dark. Mitigate with: Consiglieri thread provides guidance without breaking immersion.

## Migration Plan

This is a net-new product, not a migration.

1. Deploy Railway project with PostgreSQL and Redis
2. Deploy backend API service
3. Deploy web client
4. Seed initial NPC configurations
5. Test end-to-end flow: player sends message → server parses intent → simulation updates → AI generates response → message delivered
6. Soft launch for internal testing

## Open Questions

- **Q1: How long should NPC response delays be?** Real NPCs don't reply instantly. Need a delay mechanism (fixed, random, or based on "typing" indicator).
- **Q2: What's the initial game state?** Does player start as Boss, or work up? Initial family size, money, territories?
- **Q3: How do we handle save/load?** Player closes browser, returns later. Game state must persist and restore seamlessly.
- **Q4: Moderation thresholds?** What triggers auto-block vs flag for review?