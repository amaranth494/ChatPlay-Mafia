## 1. Infrastructure Setup

- [ ] 1.1 Initialize Railway project with PostgreSQL and Redis
- [x] 1.2 Set up Node.js/TypeScript backend project structure
- [x] 1.3 Configure VS Code + Kilo Code workflow
- [x] 1.4 Set up Next.js/React web client project
- [x] 1.5 Configure environment variables and secrets management

## 2. Database & Models

- [x] 2.1 Define database schema (players, NPCs, missions, relationships, territories)
- [x] 2.2 Create TypeScript interfaces matching database schema
- [ ] 2.3 Set up database migration system
- [ ] 2.4 Implement Redis session and cache layer

## 3. Mafia Simulation Engine

- [ ] 3.1 Implement Family entity (money, territories, hierarchy)
- [ ] 3.2 Implement NPC entity (role, health, relationships, personality)
- [ ] 3.3 Implement Mission system (delegation, outcome calculation)
- [ ] 3.4 Implement Relationship system (loyalty tracking, updates)
- [ ] 3.5 Implement Phase system (day/night cycles, events)

## 4. Player Intent Parser

- [ ] 4.1 Build command parser (/mission, /promote, /demote, etc.)
- [ ] 4.2 Implement natural language intent classification
- [ ] 4.3 Add validation layer for game actions
- [ ] 4.4 Integrate with Consiglieri for clarification responses

## 5. AI Dialogue Generation

- [ ] 5.1 Set up OpenAI Responses API client
- [ ] 5.2 Create NPC personality prompt templates
- [ ] 5.3 Implement context injection (NPC state, recent events)
- [ ] 5.4 Implement response rate limiting per NPC
- [ ] 5.5 Add memory/context retrieval for conversation continuity

## 6. Moderation Layer

- [ ] 6.1 Integrate OpenAI moderation endpoint for player input
- [ ] 6.2 Integrate OpenAI moderation endpoint for NPC output
- [ ] 6.3 Implement fallback regeneration for flagged content
- [ ] 6.4 Set up moderation logging and admin review queue

## 7. WebSocket Messaging

- [x] 7.1 Implement WebSocket server for real-time messaging
- [ ] 7.2 Set up message routing between client and simulation engine
- [ ] 7.3 Implement message queue for NPC response timing
- [x] 7.4 Add connection handling (reconnect, auth)

## 8. Diegetic Messaging Client

- [x] 8.1 Build thread list UI with unread indicators
- [x] 8.2 Implement message display with timestamps
- [x] 8.3 Create message composition interface
- [ ] 8.4 Add command palette for "/" commands
- [ ] 8.5 Implement archive section for dead NPCs

## 9. End-to-End Integration

- [ ] 9.1 Connect client to backend via WebSocket
- [ ] 9.2 Wire intent parser to simulation engine
- [ ] 9.3 Wire simulation outcomes to AI dialogue generation
- [ ] 9.4 Connect moderation layer to all input/output
- [ ] 9.5 Test full game loop: message → parse → simulate → respond → display

## 10. Initial Content

- [ ] 10.1 Seed initial NPCs (Consiglieri, 3-4 soldiers, associates)
- [ ] 10.2 Create initial family state (starting money, territory)
- [ ] 10.3 Write initial Consiglieri greeting
- [ ] 10.4 Define initial mission types and objectives

## 11. Deployment & Testing

- [ ] 11.1 Deploy to Railway staging environment
- [ ] 11.2 Run internal playtesting
- [ ] 11.3 Fix bugs and tune gameplay
- [ ] 11.4 Deploy to Railway production