import { supabaseAdmin } from '../config/supabase.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/* ============================================================
   UTILITIES
   ============================================================ */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ============================================================
   BRANDED HTML EMAIL BUILDER
   Table-based, inline CSS, works in Gmail / Outlook / Apple Mail.
   ============================================================ */
function buildEmailHTML(body, status, meta) {
  var BRAND = {
    name: 'PrimeTrust',
    tagline: 'Secure Digital Brokerage',
    accent: '#D9A321',
    accentBright: '#F0B82D',
    navy: '#061A3A',
    navyLight: '#0A2145',
    text: '#071B3B',
    muted: '#526174',
    border: '#E5EAF1',
    bg: '#F7F9FC',
    white: '#FFFFFF',
  };

  /* Status badge configuration */
  var statusConfig = {
    pending:   { label: 'Pending Review', color: '#8A6814', bg: '#FEF6E0', icon: '\u23F3' },
    completed: { label: 'Completed',      color: '#1E7A55', bg: '#E0F7ED', icon: '\u2713' },
    refunded:  { label: 'Refunded',       color: '#475569', bg: '#F1F5F9', icon: '\u21BA' },
    cancelled: { label: 'Cancelled',      color: '#A52E2E', bg: '#FEEAEA', icon: '\u2715' },
  };

  var sc = statusConfig[status];
  var badgeHtml = '';
  if (sc) {
    badgeHtml =
      '<tr><td align="center" style="padding:28px 32px 0;">' +
        '<div style="display:inline-block;background:' + sc.bg + ';color:' + sc.color + ';' +
          'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;' +
          'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;' +
          'padding:8px 18px;border-radius:100px;' +
          'border:1px solid ' + sc.color + '33;">' +
          sc.icon + '&nbsp;&nbsp;' + sc.label +
        '</div>' +
      '</td></tr>';
  }

  /* Body paragraphs */
  var paras = String(body || '')
    .split(/\n{2,}/)
    .map(function (block) {
      return block
        .split('\n')
        .map(function (line) { return escapeHtml(line); })
        .join('<br>');
    })
    .filter(function (p) { return p.trim(); })
    .map(function (block) {
      return '<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:' + BRAND.text + ';">' + block + '</p>';
    })
    .join('');

  /* Transaction summary card (only for status emails with meta) */
  var metaHtml = '';
  if (sc && meta && (meta.amount || meta.reference)) {
    var rows = [];
    if (meta.amount) {
      rows.push(
        '<tr>' +
          '<td style="padding:8px 0;font-size:12.5px;color:' + BRAND.muted + ';font-weight:500;">Amount</td>' +
          '<td align="right" style="padding:8px 0;font-size:13px;color:' + BRAND.text + ';font-weight:700;">' + escapeHtml(meta.amount) + '</td>' +
        '</tr>'
      );
    }
    if (meta.method) {
      rows.push(
        '<tr>' +
          '<td style="padding:8px 0;font-size:12.5px;color:' + BRAND.muted + ';font-weight:500;">Method</td>' +
          '<td align="right" style="padding:8px 0;font-size:13px;color:' + BRAND.text + ';font-weight:700;">' + escapeHtml(meta.method) + '</td>' +
        '</tr>'
      );
    }
    if (meta.reference) {
      rows.push(
        '<tr>' +
          '<td style="padding:8px 0;font-size:12.5px;color:' + BRAND.muted + ';font-weight:500;">Reference</td>' +
          '<td align="right" style="padding:8px 0;font-size:12.5px;color:' + BRAND.text + ';font-weight:700;font-family:\'SF Mono\',Consolas,monospace;letter-spacing:.5px;">#' + escapeHtml(meta.reference) + '</td>' +
        '</tr>'
      );
    }
    if (meta.date) {
      rows.push(
        '<tr>' +
          '<td style="padding:8px 0;font-size:12.5px;color:' + BRAND.muted + ';font-weight:500;">Date</td>' +
          '<td align="right" style="padding:8px 0;font-size:13px;color:' + BRAND.text + ';font-weight:700;">' + escapeHtml(meta.date) + '</td>' +
        '</tr>'
      );
    }

    if (rows.length) {
      metaHtml =
        '<tr><td style="padding:8px 32px 8px;">' +
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" ' +
            'style="background:' + BRAND.bg + ';border:1px solid ' + BRAND.border + ';border-radius:12px;">' +
            '<tr><td style="padding:14px 16px 4px;font-size:10.5px;font-weight:700;color:' + BRAND.muted + ';letter-spacing:1.2px;text-transform:uppercase;">Transaction Details</td></tr>' +
            '<tr><td style="padding:0 16px 8px;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
                rows.join('') +
              '</table>' +
            '</td></tr>' +
          '</table>' +
        '</td></tr>';
    }
  }

  return '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="color-scheme" content="light">' +
      '<meta name="x-apple-disable-message-reformatting">' +
      '<title>' + escapeHtml(BRAND.name) + '</title>' +
    '</head>' +
    '<body style="margin:0;padding:0;background:' + BRAND.bg + ';' +
      'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Arial,sans-serif;' +
      '-webkit-font-smoothing:antialiased;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" ' +
        'style="background:' + BRAND.bg + ';padding:32px 12px;">' +
        '<tr><td align="center">' +

          /* Main card */
          '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" ' +
            'style="max-width:600px;width:100%;background:' + BRAND.white + ';' +
            'border-radius:20px;overflow:hidden;' +
            'box-shadow:0 8px 32px rgba(7,27,59,.08);">' +

            /* Header */
            '<tr><td style="background:' + BRAND.navy + ';' +
              'background-image:linear-gradient(160deg,' + BRAND.navyLight + ',' + BRAND.navy + ');' +
              'padding:36px 32px 32px;text-align:center;">' +
              '<div style="display:inline-block;width:52px;height:52px;border-radius:14px;' +
                'background:' + BRAND.accent + ';' +
                'background-image:linear-gradient(150deg,' + BRAND.accentBright + ',' + BRAND.accent + ');' +
                'margin-bottom:16px;' +
                'box-shadow:0 8px 20px rgba(217,163,33,.35);' +
                'text-align:center;line-height:52px;' +
                'font-size:26px;color:' + BRAND.navy + ';font-weight:900;' +
                'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">P</div>' +
              '<div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px;' +
                'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">' +
                BRAND.name + '</div>' +
              '<div style="font-size:10.5px;letter-spacing:2px;text-transform:uppercase;' +
                'color:' + BRAND.accentBright + ';margin-top:6px;font-weight:700;">' +
                BRAND.tagline + '</div>' +
            '</td></tr>' +

            /* Status badge */
            badgeHtml +

            /* Body */
            '<tr><td style="padding:28px 32px 8px;">' + paras + '</td></tr>' +

            /* Meta card */
            metaHtml +

            /* Divider */
            '<tr><td style="padding:16px 32px 0;">' +
              '<div style="height:1px;background:' + BRAND.border + ';"></div>' +
            '</td></tr>' +

            /* Footer */
            '<tr><td style="padding:20px 32px 32px;text-align:center;">' +
              '<div style="font-size:12px;color:' + BRAND.muted + ';line-height:1.6;' +
                'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">' +
                '<strong style="color:' + BRAND.text + ';font-size:12.5px;">PrimeTrust Financial LLC</strong><br>' +
                'Registered broker-dealer &middot; Member SIPC<br>' +
                '<span style="font-size:11px;color:#9AA7B8;">' +
                  'Questions? Contact ' +
                  '<a href="mailto:support@primetrust.com" style="color:' + BRAND.accent + ';text-decoration:none;font-weight:600;">support@primetrust.com</a>' +
                '</span>' +
              '</div>' +
            '</td></tr>' +

          '</table>' +

          /* Below-card footer */
          '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" ' +
            'style="max-width:600px;width:100%;margin-top:24px;">' +
            '<tr><td style="text-align:center;font-size:10.5px;color:#9AA7B8;' +
              'line-height:1.6;padding:0 24px;' +
              'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">' +
              'You\'re receiving this notification because you have a PrimeTrust account.<br>' +
              '&copy; 2026 PrimeTrust Financial LLC &middot; All rights reserved.' +
            '</td></tr>' +
          '</table>' +

        '</td></tr>' +
      '</table>' +
    '</body></html>';
}

/* ============================================================
   PLAIN TEXT FALLBACK (improves deliverability significantly)
   ============================================================ */
function buildEmailText(body, status, meta) {
  var lines = [];
  lines.push('PrimeTrust');
  lines.push('Secure Digital Brokerage');
  lines.push('');

  var statusLabels = {
    pending: 'PENDING REVIEW',
    completed: 'COMPLETED',
    refunded: 'REFUNDED',
    cancelled: 'CANCELLED',
  };
  if (statusLabels[status]) {
    lines.push('Status: ' + statusLabels[status]);
    lines.push('');
  }

  lines.push(body || '');
  lines.push('');

  if (meta && (meta.amount || meta.reference)) {
    lines.push('----- Transaction Details -----');
    if (meta.amount) lines.push('Amount: ' + meta.amount);
    if (meta.method) lines.push('Method: ' + meta.method);
    if (meta.reference) lines.push('Reference: #' + meta.reference);
    if (meta.date) lines.push('Date: ' + meta.date);
    lines.push('');
  }

  lines.push('-----');
  lines.push('PrimeTrust Financial LLC');
  lines.push('Registered broker-dealer . Member SIPC');
  lines.push('Questions? Contact support@primetrust.com');
  lines.push('');
  lines.push('You\'re receiving this notification because you have a PrimeTrust account.');
  lines.push('(c) 2026 PrimeTrust Financial LLC');

  return lines.join('\n');
}

/* ============================================================
   GET /api/admin/withdrawals
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
   Body: { status, subject, body, meta }
   ============================================================ */
export async function sendWithdrawalEmail(req, res) {
  try {
    const txId = req.params.id;
    const { status, subject, body, meta } = req.body || {};

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and message body are required.' });
    }

    const allowedStatuses = ['pending', 'completed', 'refunded', 'cancelled', null];
    if (status !== undefined && status !== null && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    /* Look up transaction + user */
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

    /* Update transaction status if a status was supplied */
    if (status) {
      await supabaseAdmin
        .from('transactions')
        .update({ status })
        .eq('id', txId);
    }

    /* Brevo config */
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'PrimeTrust';

    if (!apiKey || !senderEmail) {
      return res.status(500).json({ error: 'Email service is not configured.' });
    }

    const fullName = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim();

    /* Build HTML + plain text parts */
    const html = buildEmailHTML(body, status, meta);
    const text = buildEmailText(body, status, meta);

    const brevoPayload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: profile.email, name: fullName || profile.email }],
      subject: String(subject).slice(0, 250),
      htmlContent: html,
      textContent: text,
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
