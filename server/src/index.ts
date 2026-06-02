import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import GlobalErrorHandler from './app/middlewares/globalErrorHandler';
import appRoutes from './app/routes';
import { registerUserHandlers } from './app/socket/userHandlers';
import { registerChatHandlers } from './app/socket/chatHandlers';
import { registerCallHandlers } from './app/socket/callHandlers';
import { registerFriendHandlers } from './app/socket/friendHandlers';

dotenv.config();

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), 'server/.env.local'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../.env.local'),
  path.resolve(process.cwd(), '../server/.env'),
  path.resolve(process.cwd(), '../server/.env.local')
];

for (const envFile of envFiles) {
  dotenv.config({ path: envFile });
}

const app: Express = express();
const port = process.env.PORT || 8888;
const corsOptions = {
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:8887',
    'https://chat.smtsigma.com',
    'https://api.chat.smtsigma.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin',
    'Cache-Control',
    'X-CSRF-Token',
    'User-Agent',
    'Content-Length'
  ],
  credentials: true
};

// Create HTTP server with Socket.IO
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes (mounted under /api)
app.use('/api', appRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Global error handler for Express
app.use(GlobalErrorHandler);

// Socket.IO shared state
import { activeUsers } from './app/socket/state';

// Export activeUsers so routes can use it for real-time notifications
export { activeUsers };

// Socket.IO connection handling
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register modular socket handlers
  registerUserHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerCallHandlers(io, socket);
  registerFriendHandlers(io, socket);
});

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Socket.IO server ready for connections`);
});
