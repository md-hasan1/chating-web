import express from 'express';
import { authController } from './controller';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/guest-login', authController.guestLogin);
router.get('/me', authController.getCurrentUser);
router.post('/logout', authController.logout);

export default router;
