import { supabaseAdmin } from '../config/supabase.js';

/**
 * GET /api/admin/users
 */
export async function listUsers(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, phone, balance, role, status, created_at')
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
        note: req.body.reason || (delta > 0 ? 'Deposit from PrimeTrust' : 'Admin debit'),
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

/**
 * GET /api/admin/users/:id/transactions
 */
export async function getUserTransactions(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, tx_type, amount, status, note, created_at')
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[getUserTransactions]', error);
      return res.status(500).json({ error: 'Could not load transactions.' });
    }

    return res.status(200).json({ transactions: data || [] });
  } catch (err) {
    console.error('[getUserTransactions]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/transactions
 * All recent transactions across all users.
 */
export async function listAllTransactions(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, user_id, tx_type, amount, status, note, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[listAllTransactions]', error);
      return res.status(500).json({ error: 'Could not load transactions.' });
    }

    return res.status(200).json({ transactions: data || [] });
  } catch (err) {
    console.error('[listAllTransactions]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
