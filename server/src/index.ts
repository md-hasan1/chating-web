import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import GlobalErrorHandler from './app/middlewares/globalErrorHandler';
import appRoutes from './app/routes';
import { registerUserHandlers } from './app/socket/userHandlers';
import { registerChatHandlers } from './app/socket/chatHandlers';
import { registerCallHandlers } from './app/socket/callHandlers';
import { registerFriendHandlers } from './app/socket/friendHandlers';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8888;
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'https://chat.smtsigma.com')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginSet = new Set(allowedOrigins);

const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOriginSet.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
};

const applyCorsHeaders = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin && allowedOriginSet.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    );
    res.sendStatus(204);
    return;
  }

  next();
};

// Create HTTP server with Socket.IO
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: corsOptions
});

// Middleware
app.use(applyCorsHeaders);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

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
