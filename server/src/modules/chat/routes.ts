import express from 'express';
import { chatController } from './controller';
import { authMiddleware } from '../../middlewares/auth';

const router = express.Router();

router.post('/', authMiddleware(), chatController.createChat);
router.post('/direct', authMiddleware(), chatController.createDirectChat);
router.get('/', authMiddleware(), chatController.getChats);
router.get('/:chatId', authMiddleware(), chatController.getChatById);
router.delete('/:chatId', authMiddleware(), chatController.deleteChat);

export default router;
