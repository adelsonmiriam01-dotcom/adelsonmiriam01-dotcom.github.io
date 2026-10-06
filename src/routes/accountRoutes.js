import { Router } from 'express';
import { me, withdraw } from '../controllers/accountController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.get('/me', requireAuth, me);
router.post('/withdraw', requireAuth, withdraw);
export default router;
