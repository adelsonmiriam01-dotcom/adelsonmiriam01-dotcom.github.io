import { supabaseAdmin } from '../config/supabase.js';

/**
 * Accepts EITHER:
 *   1. The gate password "Big-Investor" as a Bearer token (simple admin access)
 *   2. A real Supabase JWT whose profile.role = 'admin'
 */
export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    // Gate password shortcut
    if (token === 'Big-Investor') {
      req.user = { id: 'admin-gate', email: 'admin@gate' };
      req.profile = { role: 'admin' };
      return next();
    }

    // Real Supabase token path
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    req.user = data.user;
    req.profile = profile;
    next();
  } catch (err) {
    console.error('[requireAdmin]', err);
    return res.status(500).json({ error: 'Authentication service error.' });
  }
}
