import express from 'express';
import authRoutes from '../../modules/auth/routes';
import chatRoutes from '../../modules/chat/routes';
import messageRoutes from '../../modules/message/routes';
import userRoutes from '../../modules/users/routes';
import friendRoutes from '../../modules/friend/routes';

const router = express.Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/chat', route: chatRoutes },
  { path: '/message', route: messageRoutes },
  { path: '/users', route: userRoutes },
  { path: '/friend', route: friendRoutes },
];

moduleRoutes.forEach(r => router.use(r.path, r.route));

export default router;
