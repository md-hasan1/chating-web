# Development Setup

## Running Both Frontend and Backend Together

### Initial Setup
Run this command once to install all dependencies for both frontend and backend:

```bash
npm run setup
```

This will install dependencies in the root (frontend) and server folders.

### Start Development Servers

Run both frontend and backend simultaneously:

```bash
npm run dev
```

This will start:
- **Frontend**: Next.js dev server on `http://localhost:3000`
- **Backend**: Express server on `http://localhost:5000`

Both servers will run in the same terminal with color-coded output.

### Individual Server Commands

**Frontend only:**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

**Production builds:**
```bash
npm run build           # Build frontend
npm run build:backend   # Build backend
```

**Production start:**
```bash
npm start              # Start frontend
npm run start:backend  # Start backend
```

## Environment Setup

### Frontend (.env.local)
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Backend (server/.env)
```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/chat-db
JWT_SECRET=your-secret-key
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## First Time Setup Checklist

1. ✅ Run `npm run setup` to install all dependencies
2. ✅ Create `.env.local` in root with Google Client ID
3. ✅ Create `server/.env` with MongoDB URL and JWT Secret
4. ✅ Run `npm run dev` to start both servers
5. ✅ Open http://localhost:3000 in your browser

## Troubleshooting

### Port Already in Use
If port 5000 is in use:
- Change `PORT=5001` in `server/.env`
- Update `NEXT_PUBLIC_API_URL=http://localhost:5001` in `.env.local`

### Terminal Colors Not Showing
Both outputs are prefixed with `[frontend]` and `[backend]` labels.

### Need to Stop One Server
Press `Ctrl+C` to stop both. To run individual servers, use:
```bash
npm run dev:frontend
npm run dev:backend
```

## What's Running

| Component | URL | Tech |
|-----------|-----|------|
| Frontend | http://localhost:3000 | Next.js + React |
| Backend API | http://localhost:5000 | Express + Node.js |
| API Health | http://localhost:5000/health | Express endpoint |
| Database | MongoDB Atlas | Cloud hosted |

## IDE Tips

### VS Code
- Terminal will show both outputs with labels
- Click on terminal to focus and see individual server logs
- Use split terminal to view both separately

### WebStorm/IntelliJ
- Create run configuration for `npm run dev`
- Both servers appear in Run console

## Performance Notes

- Frontend builds on save (HMR enabled)
- Backend requires manual restart on changes
- For better DX, consider using separate terminals:
  - Terminal 1: `npm run dev:frontend`
  - Terminal 2: `npm run dev:backend`
