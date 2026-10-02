import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';

const app = express();

/* ---------- Security headers ---------- */
app.use(helmet());

/* ---------- CORS ---------- */
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, mobile apps, health checks).
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  })
);

/* ---------- Body parsing ---------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------- Logging ---------- */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ---------- Rate limiting ---------- */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

app.use('/api/auth', authLimiter);

/* ---------- Health check ---------- */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'primetrust-api', timestamp: new Date().toISOString() });
});

/* ---------- Routes ---------- */
app.use('/api/auth', authRoutes);

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