import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

/* ---------- Security headers ---------- */
app.use(helmet());

/* ============================================================
   CORS — allow everything (no blocking)
   ============================================================ */
app.use(
  cors({
    origin: true,          // reflect the request origin
    credentials: true,     // allow cookies / Authorization header
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Respond to preflight requests.
app.options('*', cors());

/* ---------- Body parsing ---------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------- Logging ---------- */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ============================================================
   Rate limiting
   ============================================================ */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

app.use('/api/auth', authLimiter);

/* ---------- Health check ---------- */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'primetrust-api',
    timestamp: new Date().toISOString(),
    cors: 'open — all origins allowed',
  });
});

/* ---------- Routes ---------- */
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);

/* ---------- 404 ---------- */
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

/* ---------- Error handler ---------- */
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

export default app;
