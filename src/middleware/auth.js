import { supabaseAdmin } from '../config/supabase.js';

/**
 * Verifies a Supabase access token sent in the Authorization header.
 * Attaches the authenticated user to req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error('[requireAuth]', err);
    return res.status(500).json({ error: 'Authentication service error.' });
  }
}

/**
 * Optional auth — does not block the request if no token is present,
 * but attaches the user if a valid token is found.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data?.user) req.user = data.user;
    }
  } catch (err) {
    // silently ignore
  }
  next();
}
