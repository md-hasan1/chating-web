import express from 'express';
import { friendController } from './controller';
import { authMiddleware } from '../../middlewares/auth';

const router = express.Router();

router.post('/request', authMiddleware(), friendController.sendFriendRequest);
router.get('/pending', authMiddleware(), friendController.getPendingRequests);
router.get('/sent', authMiddleware(), friendController.getSentRequests);
router.get('/list', authMiddleware(), friendController.getFriendsList);
router.post('/accept', authMiddleware(), friendController.acceptFriendRequest);
router.post('/reject', authMiddleware(), friendController.rejectFriendRequest);

export default router;
