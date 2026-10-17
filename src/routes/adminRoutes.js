import { Router } from 'express';
import {
  listUsers,
  adjustBalance,
  getUserTransactions,
  listAllTransactions,
} from '../controllers/adminController.js';
import {
  listChats,
  getChatThread,
  replyToUser,
  unreadCount,
} from '../controllers/messagesController.js';
import {
  listWithdrawals,
  sendWithdrawalEmail,
  previewEmail,
  diagnoseEmail,
} from '../controllers/emailController.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

router.get('/users', requireAdmin, listUsers);
router.post('/users/:id/balance', requireAdmin, adjustBalance);
router.get('/users/:id/transactions', requireAdmin, getUserTransactions);
router.get('/transactions', requireAdmin, listAllTransactions);

router.get('/chats', requireAdmin, listChats);
router.get('/chats/:userId', requireAdmin, getChatThread);
router.post('/chats/:userId/reply', requireAdmin, replyToUser);
router.get('/messages/unread', requireAdmin, unreadCount);

router.get('/withdrawals', requireAdmin, listWithdrawals);
router.post('/withdrawals/:id/email', requireAdmin, sendWithdrawalEmail);
router.post('/email/preview', requireAdmin, previewEmail);
router.post('/email/diagnose', requireAdmin, diagnoseEmail);

export default router;
