# Chat Application

A full-stack chat application with Google OAuth authentication, built with Next.js frontend and Node.js/Express backend.

## Architecture

### Frontend (Next.js)
- Modern React 19 with TypeScript
- Google OAuth authentication with `@react-oauth/google`
- Real-time chat interface with Tailwind CSS
- Context API for state management
- Protected routes with auth middleware

### Backend (Node.js/Express)
- TypeScript for type safety
- Express.js REST API
- Prisma ORM for database operations
- MongoDB for data persistence
- JWT-based authentication
- CORS enabled for frontend communication

### Database (MongoDB)
- User management with OAuth integration
- Chat history persistence
- Message storage with timestamps

## Project Structure

```
chat-web/
├── app/                          # Next.js frontend
│   ├── auth/page.tsx            # Login page with Google OAuth
│   ├── chat/page.tsx            # Main chat interface
│   ├── components/              # React components
│   │   ├── ChatSidebar.tsx      # Chat list sidebar
│   │   ├── MessageList.tsx      # Message display
│   │   └── MessageInput.tsx     # Message input form
│   ├── context/                 # Context providers
│   │   ├── AuthContext.tsx      # Auth state management
│   │   └── ChatContext.tsx      # Chat state management
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home redirect page
│
├── server/                       # Express backend
│   ├── src/
│   │   ├── index.ts            # Main server file
│   │   ├── routes/
│   │   │   ├── auth.ts         # Authentication endpoints
│   │   │   ├── chat.ts         # Chat management endpoints
│   │   │   └── message.ts      # Message endpoints
│   │   └── middleware/
│   │       └── auth.ts         # JWT auth middleware
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                # Frontend dependencies
├── .env.local                  # Frontend environment variables
└── README.md
```

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account (or local MongoDB)
- Google Cloud Console project for OAuth

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google OAuth 2.0 API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000`
   - `http://localhost:3000/auth`
6. Copy your Client ID

### 3. MongoDB Setup

1. Create a MongoDB Atlas account at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create a cluster (free tier available)
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/chat-db`

### 4. Frontend Setup

```bash
# Install dependencies
npm install

# Create .env.local (already created, update values)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_API_URL=http://localhost:5000

# Run development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 5. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Update .env with your values:
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/chat-db
JWT_SECRET=your-super-secret-key
PORT=5000
FRONTEND_URL=http://localhost:3000

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Backend will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/google-login` - Google OAuth login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Chats
- `GET /api/chat` - Get all user chats
- `POST /api/chat` - Create new chat
- `GET /api/chat/:chatId` - Get chat with messages
- `DELETE /api/chat/:chatId` - Delete chat

### Messages
- `POST /api/message` - Add message to chat
- `GET /api/message/:chatId` - Get chat messages

## Features

### Implemented
✅ Google OAuth authentication
✅ User profile management
✅ Chat creation and management
✅ Message storage and retrieval
✅ JWT token-based authentication
✅ Real-time UI updates
✅ Responsive design with Tailwind CSS
✅ MongoDB integration with Prisma

### Ready for Enhancement
- AI/LLM integration (OpenAI, Anthropic, etc.)
- WebSocket support for real-time messaging
- User profile customization
- Chat search and filtering
- Message export/download
- User presence indicators
- Typing indicators
- Message editing and deletion
- File uploads and sharing

## Environment Variables

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

## Development Commands

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Backend
```bash
npm run dev                  # Start development server
npm run build               # Build TypeScript
npm run start               # Start production server
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Run database migrations
npm run prisma:studio       # Open Prisma Studio (visual DB manager)
```

## Deployment

### Frontend (Vercel)
```bash
npm install -g vercel
vercel
```

### Backend (Heroku, Railway, or similar)
```bash
# Build
npm run build

# Deploy (varies by platform)
```

## Troubleshooting

### MongoDB Connection Issues
- Check connection string format
- Ensure IP whitelist includes your machine
- Verify database name is correct

### Google OAuth Errors
- Confirm Client ID is correct
- Check authorized redirect URIs
- Verify CORS is enabled on backend

### CORS Errors
- Backend CORS is configured for frontend URL
- Update FRONTEND_URL in server/.env if needed

### Token Expiration
- Token expiry is set to 7 days
- Implement token refresh logic for production

## Next Steps

1. Add AI integration (OpenAI, Claude, etc.)
2. Implement WebSocket for real-time messaging
3. Add message persistence with timestamps
4. Create admin dashboard
5. Add user roles and permissions
6. Implement message search
7. Add file upload capability
8. Deploy to production

## License

MIT

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
