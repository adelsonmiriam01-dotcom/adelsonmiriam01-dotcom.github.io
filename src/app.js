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
   CORS — robust configuration
   ============================================================ */
const rawOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, '')) // strip trailing slashes
  .filter(Boolean);

// Always allow localhost during development.
const allowedOrigins = new Set([
  ...rawOrigins,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

// Pattern for Netlify preview deploys: *.netlify.app
// e.g. https://deploy-preview-42--prime-tru.netlify.app
const NETLIFY_PATTERN = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;
const NETLIFY_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i;

app.use(
  cors({
    origin(origin, callback) {
      // No origin: Postman, curl, mobile apps, health checks — allow.
      if (!origin) return callback(null, true);

      const clean = origin.replace(/\/+$/, '');

      if (allowedOrigins.has(clean)) {
        return callback(null, true);
      }
      if (NETLIFY_PATTERN.test(clean) || NETLIFY_PREVIEW_PATTERN.test(clean)) {
        return callback(null, true);
      }

      console.warn('[CORS] Blocked origin:', clean);
      console.warn('[CORS] Allowed origins:', [...allowedOrigins].join(', '));
      return callback(new Error(`CORS blocked for origin: ${clean}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Handle preflight requests explicitly (Express 4 doesn't auto-respond).
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // max 60 requests per window per IP (raised for dev + retries)
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
    allowedOrigins: [...allowedOrigins],
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

  // CORS errors — return 403 with a clear message instead of 500.
  if (err && err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

export default app;
