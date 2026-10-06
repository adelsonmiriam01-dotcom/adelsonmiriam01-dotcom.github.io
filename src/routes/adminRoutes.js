import { Router } from 'express';
import { adminLogin, listUsers, adjustBalance } from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.post('/login', adminLogin);
router.get('/users', requireAdmin, listUsers);
router.post('/users/:id/balance', requireAdmin, adjustBalance);
export default router;
