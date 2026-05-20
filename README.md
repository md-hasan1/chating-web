This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account (or local MongoDB)
- Google Cloud Console OAuth credentials

### Quick Setup

1. **Install all dependencies** (frontend + backend):
```bash
npm run setup
```

2. **Configure environment variables:**

Create `.env.local` in root:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Create `server/.env`:
```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/chat-db
JWT_SECRET=your-secret-key
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

3. **Start both servers:**
```bash
npm run dev
```

This runs both:
- Frontend on [http://localhost:3000](http://localhost:3000)
- Backend on [http://localhost:5000](http://localhost:5000)

### Development Commands

```bash
# Run both frontend and backend
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Build frontend
npm run build

# Build backend
npm run build:backend
```

### Detailed Setup Instructions

See [SETUP.md](SETUP.md) for comprehensive setup guide including:
- Google OAuth setup
- MongoDB configuration
- API endpoints
- Troubleshooting

See [DEV.md](DEV.md) for development workflow details.

## Project Structure

```
chat-web/
├── app/                    # Next.js frontend
│   ├── auth/              # Login page
│   ├── chat/              # Chat interface
│   ├── components/        # React components
│   └── context/           # State management
├── server/                # Express backend
│   ├── src/              # TypeScript source
│   ├── prisma/           # Database schema
│   └── package.json
└── README.md / SETUP.md / DEV.md
```

## Features

- ✅ Google OAuth 2.0 authentication
- ✅ Real-time chat interface
- ✅ MongoDB with Prisma ORM
- ✅ JWT token authentication
- ✅ RESTful API
- ✅ TypeScript for type safety
- ✅ Tailwind CSS responsive design
- ✅ Production ready
