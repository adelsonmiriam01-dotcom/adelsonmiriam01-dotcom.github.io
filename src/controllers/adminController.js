import { supabaseAdmin } from '../config/supabase.js';

/**
 * POST /api/admin/login
 */
export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (sessionError || !sessionData?.session) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', sessionData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'This account does not have admin access.' });
    }

    return res.status(200).json({
      token: sessionData.session.access_token,
      admin: {
        id: sessionData.user.id,
        email: sessionData.user.email,
      },
    });
  } catch (err) {
    console.error('[adminLogin]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/users
 */
export async function listUsers(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, phone, balance, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[listUsers]', error);
      return res.status(500).json({ error: 'Could not load users.' });
    }

    return res.status(200).json({ users: data || [] });
  } catch (err) {
    console.error('[listUsers]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/admin/users/:id/balance
 * Body: { delta: number, reason?: string }
 */
export async function adjustBalance(req, res) {
  try {
    const userId = req.params.id;
    const delta = parseFloat(req.body.delta);

    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({ error: 'A non-zero delta is required.' });
    }

    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !profile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentBalance = parseFloat(profile.balance || 0);
    const newBalance = currentBalance + delta;

    if (newBalance < 0) {
      return res.status(400).json({ error: 'Balance cannot go below zero.' });
    }

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updErr) {
      console.error('[adjustBalance]', updErr);
      return res.status(500).json({ error: 'Could not update balance.' });
    }

    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        tx_type: delta > 0 ? 'deposit' : 'withdrawal',
        amount: Math.abs(delta),
        status: 'completed',
        note: req.body.reason || (delta > 0 ? 'Admin credit' : 'Admin debit'),
      })
      .then(function () {})
      .catch(function () {});

    return res.status(200).json({
      message: 'Balance updated.',
      balance: newBalance,
    });
  } catch (err) {
    console.error('[adjustBalance]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
