## Why

ChatPlay Mafia is a new category of game—a conversation-first strategy simulation where players run a fictional mafia family entirely through message threads with NPCs. The player never acts directly; they delegate, persuade, and manipulate through conversation. No existing game delivers this experience—all Mafia games are social deduction (vote to lynch), not management simulation through dialogue.

## What Changes

- Create a server-authoritative mafia family simulation with NPC management, territory, money, and mission systems
- Build a diegetic messaging client (web first) that presents game experience as message threads, not dashboards
- Integrate OpenAI Responses API to generate NPC dialogue that expresses simulation results
- Implement Consiglieri (permanent advisor thread), mission delegation, and archive system for dead contacts
- Separate simulation logic (source of truth) from AI dialogue generation (how NPCs express truth)

## Capabilities

### New Capabilities
- `mafia-simulation`: Core game engine managing family money, territories, relationships, missions, and NPC states
- `npc-dialogue-generation`: AI layer using OpenAI Responses API to render NPC voice and personality
- `diegetic-messaging-client`: Web client presenting game as message threads with diegetic affordances
- `player-intent-parser`: System to interpret player messages into game actions
- `moderation-layer`: Content filtering on both player input and NPC output via OpenAI moderation endpoint

### Modified Capabilities
(none - this is a net-new product)

## Impact

- New web application (Next.js/React)
- New backend API (Node.js/TypeScript)
- New database (PostgreSQL on Railway)
- New cache/session store (Redis on Railway)
- New integration with OpenAI Responses API
- New mobile client (React Native/Expo - Phase 2)