import { supabaseAdmin } from '../config/supabase.js';

/**
 * GET /api/account/me
 * Returns user profile + balance + transactions for the dashboard.
 */
export async function me(req, res) {
  try {
    const userId = req.user.id;

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, phone, balance, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (profErr) {
      console.error('[account.me] profile', profErr);
      return res.status(500).json({ error: 'Could not load profile.' });
    }

    const balance = parseFloat(profile?.balance || 0);

    const { data: txRows } = await supabaseAdmin
      .from('transactions')
      .select('id, tx_type, amount, status, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const transactions = (txRows || []).map(function (t) {
      const signed = ['withdrawal', 'fee'].includes(t.tx_type)
        ? -Math.abs(t.amount)
        : Math.abs(t.amount);
      return {
        id: t.id,
        title: t.note || t.tx_type.charAt(0).toUpperCase() + t.tx_type.slice(1),
        amount: signed,
        status: t.status,
        created_at: t.created_at,
      };
    });

    return res.status(200).json({
      user: {
        id: profile.id,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || req.user.email || '',
        phone: profile.phone || '',
      },
      balance: balance,
      invested: 0,
      todayChange: 0,
      todayPct: 0,
      totalReturn: 0,
      buyingPower: balance,
      holdings: [],
      transactions: transactions,
    });
  } catch (err) {
    console.error('[account.me]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/account/withdraw
 * Body: { amount: number, bankAccountId: string }
 */
export async function withdraw(req, res) {
  try {
    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'A valid withdrawal amount is required.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .maybeSingle();

    const currentBalance = parseFloat(profile?.balance || 0);
    if (amount > currentBalance) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    const newBalance = currentBalance - amount;
    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updErr) {
      console.error('[withdraw] balance update', updErr);
      return res.status(500).json({ error: 'Could not process withdrawal.' });
    }

    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        tx_type: 'withdrawal',
        amount: amount,
        status: 'pending',
        note: req.body.bankAccountId
          ? 'Withdrawal to ' + req.body.bankAccountId
          : 'Withdrawal request',
      })
      .then(function () {})
      .catch(function () {});

    return res.status(200).json({
      message: 'Withdrawal request submitted.',
      newBalance: newBalance,
    });
  } catch (err) {
    console.error('[withdraw]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
  }
