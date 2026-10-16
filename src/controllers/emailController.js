import { supabaseAdmin } from '../config/supabase.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/* ============================================================
   GET /api/admin/withdrawals
   Returns every withdrawal (tx_type = 'withdrawal') with user info.
   ============================================================ */
export async function listWithdrawals(req, res) {
  try {
    const { data: txs, error } = await supabaseAdmin
      .from('transactions')
      .select('id, user_id, amount, status, note, metadata, created_at')
      .eq('tx_type', 'withdrawal')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[listWithdrawals]', error);
      return res.status(500).json({ error: 'Could not load withdrawals.' });
    }

    const userIds = [...new Set((txs || []).map((t) => t.user_id))];
    let profileMap = {};

    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, balance, status')
        .in('id', userIds);

      (profiles || []).forEach((p) => { profileMap[p.id] = p; });
    }

    const withdrawals = (txs || []).map((t) => {
      const p = profileMap[t.user_id] || {};
      return {
        id: t.id,
        user_id: t.user_id,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        email: p.email || '',
        user_status: p.status || 'active',
        user_balance: parseFloat(p.balance || 0),
        amount: parseFloat(t.amount || 0),
        status: t.status,
        note: t.note || '',
        metadata: t.metadata || {},
        created_at: t.created_at,
      };
    });

    return res.status(200).json({ withdrawals });
  } catch (err) {
    console.error('[listWithdrawals]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ============================================================
   POST /api/admin/withdrawals/:id/email
   Body: { status, subject, html }
   - Updates transaction status in DB
   - Sends email via Brevo
   ============================================================ */
export async function sendWithdrawalEmail(req, res) {
  try {
    const txId = req.params.id;
    const { status, subject, html } = req.body || {};

    if (!subject || !html) {
      return res.status(400).json({ error: 'Subject and message body are required.' });
    }

    const allowedStatuses = ['pending', 'completed', 'refunded', 'cancelled', null];
    if (status !== undefined && status !== null && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    // Look up the transaction + user
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('id, user_id, amount, status, metadata')
      .eq('id', txId)
      .eq('tx_type', 'withdrawal')
      .maybeSingle();

    if (txErr || !tx) {
      return res.status(404).json({ error: 'Withdrawal not found.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', tx.user_id)
      .maybeSingle();

    if (!profile || !profile.email) {
      return res.status(400).json({ error: 'User has no email on file.' });
    }

    // If admin picked a status, update the transaction record.
    if (status) {
      const { error: updErr } = await supabaseAdmin
        .from('transactions')
        .update({ status })
        .eq('id', txId);

      if (updErr) {
        console.error('[sendWithdrawalEmail] status update', updErr);
        // Non-fatal — continue with the email send.
      }
    }

    // Send via Brevo
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'PrimeTrust';

    if (!apiKey || !senderEmail) {
      return res.status(500).json({
        error: 'Email service is not configured. Contact your administrator.',
      });
    }

    const fullName = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim();

    const brevoPayload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: profile.email, name: fullName || profile.email }],
      subject: String(subject).slice(0, 250),
      htmlContent: String(html),
      tags: ['withdrawal', status || 'custom'],
    };

    const brevoRes = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text().catch(() => '');
      console.error('[sendWithdrawalEmail] brevo error', brevoRes.status, errText);
      return res.status(502).json({
        error: 'Email could not be sent. Check your Brevo configuration.',
      });
    }

    return res.status(200).json({
      message: 'Email sent successfully.',
      status: status || null,
    });
  } catch (err) {
    console.error('[sendWithdrawalEmail]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
