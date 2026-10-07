import { Router } from 'express';
import { sendMessage, getThread } from '../controllers/messagesController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/send', requireAuth, sendMessage);
router.get('/thread', requireAuth, getThread);

export default router;
