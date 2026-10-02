import { Router } from 'express';
import {
  signup,
  login,
  refresh,
  getMe,
  logout,
  forgotPassword,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);

export default router;