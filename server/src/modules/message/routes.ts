import express from 'express';
import { messageController } from './controller';
import { authMiddleware } from '../../middlewares/auth';
import { fileUploader } from '../../middlewares/fileUploader';

const router = express.Router();

router.post('/', authMiddleware(), messageController.createMessage);
router.post('/upload', authMiddleware(), fileUploader.uploadFile, messageController.uploadFileMessage);
router.get('/:chatId', authMiddleware(), messageController.getMessages);
router.delete('/:messageId', authMiddleware(), messageController.deleteMessage);

export default router;
