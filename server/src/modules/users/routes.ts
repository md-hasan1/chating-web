import express from 'express';
import { userController } from './controller';
import { authMiddleware } from '../../middlewares';

const router = express.Router();

router.get('/', authMiddleware(), userController.getUsers);
router.put('/profile', authMiddleware(), userController.updateProfile);

export default router;
