import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import GlobalErrorHandler from './app/middlewares/globalErrorHandler';
import appRoutes from './app/routes';
import { prisma } from './shared/prisma';
import { registerUserHandlers } from './app/socket/userHandlers';
import { registerChatHandlers } from './app/socket/chatHandlers';
import { registerCallHandlers } from './app/socket/callHandlers';
import { registerFriendHandlers } from './app/socket/friendHandlers';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5000;

// Create HTTP server with Socket.IO
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Global error handler for Express
app.use(GlobalErrorHandler);

// Routes (mounted under /api)
app.use('/api', appRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

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
