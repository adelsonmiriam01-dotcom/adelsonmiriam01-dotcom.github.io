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
   BRANDED HTML EMAIL — professional, table-based, mobile-safe
   ============================================================ */
function buildEmailHTML(body, status, meta) {
  var BRAND = {
    name: 'PrimeTrust',
    tagline: 'Premium Digital Brokerage',
    accent: '#D9A321',
    accentBright: '#F0B82D',
    navy: '#061A3A',
    navyLight: '#0A2145',
    text: '#071B3B',
    bodyText: '#3E4A5C',
    muted: '#526174',
    border: '#E5EAF1',
    bg: '#EEF2F8',
    cardBg: '#F7F9FC',
    white: '#FFFFFF',
  };

  var statusConfig = {
    pending:   { label: 'Pending Review', color: '#8A6814', bg: '#FEF6E0', icon: '&#9203;' },
    completed: { label: 'Completed',      color: '#1E7A55', bg: '#E0F7ED', icon: '&#10003;' },
    refunded:  { label: 'Refunded',       color: '#475569', bg: '#F1F5F9', icon: '&#8634;' },
    cancelled: { label: 'Cancelled',      color: '#A52E2E', bg: '#FEEAEA', icon: '&#10005;' },
  };

  var sc = statusConfig[status];

  var badgeHtml = '';
  if (sc) {
    badgeHtml =
      '<tr><td style="padding:32px 40px 0;text-align:center;">' +
        '<div style="display:inline-block;background:' + sc.bg + ';color:' + sc.color + ';' +
          'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;' +
          'font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;' +
          'padding:10px 22px;border-radius:100px;' +
          'border:1px solid ' + sc.color + '33;">' +
          sc.icon + '&nbsp;&nbsp;' + sc.label +
        '</div>' +
      '</td></tr>';
  }

  /* Greeting + body paragraphs */
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
      return '<p style="margin:0 0 18px;font-size:15.5px;line-height:1.7;color:' + BRAND.bodyText + ';">' + block + '</p>';
    })
    .join('');

  /* Transaction summary card */
  var metaHtml = '';
  if (sc && meta && (meta.amount || meta.reference)) {
    var rows = [];
    var first = true;
    function row(label, value, mono) {
      var borderTop = first ? '' : 'border-top:1px solid ' + BRAND.border + ';';
      first = false;
      return (
        '<tr>' +
          '<td style="padding:10px 0;font-size:13px;color:' + BRAND.muted + ';font-weight:500;' + borderTop + '">' + label + '</td>' +
          '<td align="right" style="padding:10px 0;font-size:14px;color:' + BRAND.text + ';font-weight:700;' + borderTop +
            (mono ? 'font-family:\'SF Mono\',Consolas,monospace;letter-spacing:.5px;' : '') + '">' + value + '</td>' +
        '</tr>'
      );
    }
    if (meta.amount) rows.push(row('Amount', escapeHtml(meta.amount)));
    if (meta.method) rows.push(row('Method', escapeHtml(meta.method)));
    if (meta.reference) rows.push(row('Reference', '#' + escapeHtml(meta.reference), true));
    if (meta.date) rows.push(row('Date', escapeHtml(meta.date)));

    if (rows.length) {
      metaHtml =
        '<tr><td style="padding:8px 40px;">' +
          '<div style="background:' + BRAND.cardBg + ';border:1px solid ' + BRAND.border + ';border-radius:16px;padding:24px;">' +
            '<div style="font-size:11px;font-weight:800;color:' + BRAND.muted + ';letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">' +
              'Transaction Summary' +
            '</div>' +
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
              rows.join('') +
            '</table>' +
          '</div>' +
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
        'style="background:' + BRAND.bg + ';padding:40px 16px;">' +
        '<tr><td align="center">' +

          '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" ' +
            'style="max-width:600px;width:100%;background:' + BRAND.white + ';' +
            'border-radius:24px;overflow:hidden;' +
            'box-shadow:0 16px 48px rgba(7,27,59,.12);">' +

            /* Header */
            '<tr><td style="background:' + BRAND.navy + ';' +
              'background-image:linear-gradient(160deg,' + BRAND.navyLight + ',' + BRAND.navy + ');' +
              'padding:44px 40px 40px;text-align:center;">' +
              '<div style="display:inline-block;width:64px;height:64px;border-radius:18px;' +
                'background:' + BRAND.accent + ';' +
                'background-image:linear-gradient(150deg,' + BRAND.accentBright + ',' + BRAND.accent + ');' +
                'margin-bottom:20px;' +
                'box-shadow:0 12px 32px rgba(217,163,33,.4);' +
                'line-height:64px;text-align:center;' +
                'font-size:32px;color:' + BRAND.navy + ';font-weight:900;' +
                'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">P</div>' +
              '<div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-.8px;line-height:1.1;' +
                'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">' +
                BRAND.name + '</div>' +
              '<div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;' +
                'color:' + BRAND.accentBright + ';margin-top:10px;font-weight:700;">' +
                BRAND.tagline + '</div>' +
            '</td></tr>' +

            /* Status badge */
            badgeHtml +

            /* Body */
            '<tr><td style="padding:32px 40px 8px;">' + paras + '</td></tr>' +

            /* Meta card */
            metaHtml +

            /* CTA */
            '<tr><td style="padding:32px 40px 8px;text-align:center;">' +
              '<a href="#" style="display:inline-block;padding:15px 40px;' +
                'background:' + BRAND.accent + ';' +
                'background-image:linear-gradient(180deg,' + BRAND.accentBright + ',' + BRAND.accent + ');' +
                'color:' + BRAND.navy + ';font-size:14px;font-weight:800;text-decoration:none;' +
                'border-radius:12px;letter-spacing:.2px;' +
                'box-shadow:0 8px 24px rgba(217,163,33,.32);' +
                'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">' +
                'View in Dashboard' +
              '</a>' +
            '</td></tr>' +

            /* Divider */
            '<tr><td style="padding:32px 40px 0;">' +
              '<div style="height:1px;background:' + BRAND.border + ';"></div>' +
            '</td></tr>' +

            /* Support */
            '<tr><td style="padding:24px 40px 8px;text-align:center;">' +
              '<p style="margin:0 0 8px;font-size:13px;color:' + BRAND.muted + ';line-height:1.6;">' +
                'Questions about this transaction?' +
              '</p>' +
              '<p style="margin:0;font-size:13px;color:' + BRAND.muted + ';line-height:1.6;">' +
                'Contact us at ' +
                '<a href="mailto:support@primetrust.com" style="color:' + BRAND.accent + ';text-decoration:none;font-weight:700;">support@primetrust.com</a>' +
              '</p>' +
            '</td></tr>' +

            /* Footer */
            '<tr><td style="padding:24px 40px 40px;text-align:center;">' +
              '<p style="margin:0 0 8px;font-size:11px;color:#9AA7B8;line-height:1.6;">' +
                'PrimeTrust Financial LLC &middot; Registered broker-dealer &middot; Member SIPC' +
              '</p>' +
              '<p style="margin:0 0 8px;font-size:11px;color:#9AA7B8;line-height:1.6;">' +
                'This is an automated notification sent to you because you have a PrimeTrust account.' +
              '</p>' +
              '<p style="margin:0;font-size:10.5px;color:#C7D0DC;">' +
                '&copy; 2026 PrimeTrust Financial LLC &middot; All rights reserved.' +
              '</p>' +
            '</td></tr>' +

          '</table>' +

        '</td></tr>' +
      '</table>' +
    '</body></html>';
}

/* ============================================================
   PLAIN TEXT FALLBACK
   ============================================================ */
function buildEmailText(body, status, meta) {
  var lines = [];
  lines.push('PrimeTrust');
  lines.push('Premium Digital Brokerage');
  lines.push('');

  var labels = {
    pending: 'PENDING REVIEW',
    completed: 'COMPLETED',
    refunded: 'REFUNDED',
    cancelled: 'CANCELLED',
  };
  if (labels[status]) {
    lines.push('Status: ' + labels[status]);
    lines.push('');
  }

  lines.push(body || '');
  lines.push('');

  if (meta && (meta.amount || meta.reference)) {
    lines.push('----- Transaction Summary -----');
    if (meta.amount) lines.push('Amount: ' + meta.amount);
    if (meta.method) lines.push('Method: ' + meta.method);
    if (meta.reference) lines.push('Reference: #' + meta.reference);
    if (meta.date) lines.push('Date: ' + meta.date);
    lines.push('');
  }

  lines.push('-----');
  lines.push('Questions about this transaction? Contact support@primetrust.com');
  lines.push('PrimeTrust Financial LLC . Registered broker-dealer . Member SIPC');
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
   POST /api/admin/email/preview
   Returns the branded HTML that the recipient will see.
   ============================================================ */
export async function previewEmail(req, res) {
  try {
    const { status, body, meta } = req.body || {};
    const html = buildEmailHTML(body || '', status || null, meta || {});
    const text = buildEmailText(body || '', status || null, meta || {});
    return res.status(200).json({ html, text });
  } catch (err) {
    console.error('[previewEmail]', err);
    return res.status(500).json({ error: 'Could not build preview.' });
  }
}

/* ============================================================
   POST /api/admin/withdrawals/:id/email
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

    if (status) {
      await supabaseAdmin
        .from('transactions')
        .update({ status })
        .eq('id', txId);
    }

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'PrimeTrust';

    if (!apiKey || !senderEmail) {
      return res.status(500).json({ error: 'Email service is not configured.' });
    }

    const fullName = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim();

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
