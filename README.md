# ChatPlay Mafia

A conversation-first mafia family management game. Run your crime empire entirely through message threads with AI-driven NPCs.

## Quick Start (Local)

```bash
# Backend
cd backend
npm install
npm run dev

# Web (new terminal)
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Railway

1. **Create Railway project:**
   ```bash
   npm i -g @railway/cli
   railway login
   railway init
   ```

2. **Add PostgreSQL and Redis:**
   ```bash
   railway add -d postgres
   railway add -d redis
   ```

3. **Set environment variables:**
   ```bash
   railway env set OPENAI_API_KEY=your_key_here
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

## Architecture

```
┌──────────────┐       ┌──────────────┐
│  Web Client  │◄─────►│  Backend     │
│  (Next.js)   │       │  (Socket.io) │
└──────────────┘       └──────┬───────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐       ┌─────▼─────┐
              │ PostgreSQL│       │   Redis   │
              └───────────┘       └───────────┘
```

## Tech Stack

- **Web:** Next.js 15, React, TypeScript
- **Backend:** Node.js, Express, Socket.io
- **Database:** PostgreSQL (Railway)
- **Cache:** Redis (Railway)
- **AI:** OpenAI Responses API
- **Hosting:** Railway