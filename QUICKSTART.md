# Quick Start Guide

## 2-Minute Setup & Run

### Step 1: Install Dependencies
```bash
npm run setup
```

### Step 2: Configure Environment

**Create `.env.local` (in root):**
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Create `server/.env`:**
```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/chat-db
JWT_SECRET=any-random-string
PORT=5000
```

### Step 3: Start Both Servers
```bash
npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:5000

### Step 4: Test It
- Open http://localhost:3000
- Click "Sign in with Google"
- Create a new chat
- Start chatting!

## Commands

```bash
npm run dev                # Run both frontend and backend
npm run dev:frontend       # Frontend only
npm run dev:backend        # Backend only
npm run build              # Build frontend
npm run build:backend      # Build backend
```

## Getting Credentials

### Google Client ID
1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create project → OAuth 2.0 → Web application
3. Add authorized redirect URIs: `http://localhost:3000`
4. Copy Client ID

### MongoDB URL
1. Visit [MongoDB Atlas](https://mongodb.com/cloud/atlas)
2. Create cluster (free tier)
3. Copy connection string: `mongodb+srv://user:pass@cluster.mongodb.net/chat-db`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Google login fails | Check `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` |
| Cannot connect to DB | Check `DATABASE_URL` in `server/.env` and MongoDB whitelist |
| Port 5000 in use | Change `PORT=5001` in `server/.env` + update `NEXT_PUBLIC_API_URL` |
| CORS error | Ensure backend `FRONTEND_URL` matches frontend URL |

## What's Running

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:5000 |
| API Health | http://localhost:5000/health |

## Next Steps

1. ✅ Setup complete!
2. Explore the chat interface
3. Read [SETUP.md](SETUP.md) for deployment
4. Add AI integration for responses
5. Deploy to production

## File Locations

- Frontend code: `app/`
- Backend code: `server/src/`
- Database schema: `server/prisma/schema.prisma`
- Frontend config: `.env.local`
- Backend config: `server/.env`

Need help? See [DEV.md](DEV.md) for detailed development guide.
