import { Router } from 'express';
import {
  listUsers,
  adjustBalance,
  getUserTransactions,
  listAllTransactions,
} from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

router.get('/users', requireAdmin, listUsers);
router.post('/users/:id/balance', requireAdmin, adjustBalance);
router.get('/users/:id/transactions', requireAdmin, getUserTransactions);
router.get('/transactions', requireAdmin, listAllTransactions);

export default router;
