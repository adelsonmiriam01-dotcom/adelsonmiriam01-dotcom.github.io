import { supabaseAdmin } from '../config/supabase.js';

/* ============================================================
   USER ENDPOINTS
   ============================================================ */

export async function sendMessage(req, res) {
  try {
    const userId = req.user.id;
    const body = (req.body && req.body.body) ? String(req.body.body).trim() : '';
    if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({ user_id: userId, sender: 'user', body })
      .select()
      .single();

    if (error) {
      console.error('[sendMessage]', error);
      return res.status(500).json({ error: 'Could not send message.' });
    }

    return res.status(201).json({ message: data });
  } catch (err) {
    console.error('[sendMessage]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getThread(req, res) {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, sender, body, created_at, is_read')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('[getThread]', error);
      return res.status(500).json({ error: 'Could not load messages.' });
    }

    // Mark admin replies as read for this user
    await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('sender', 'admin')
      .eq('is_read', false)
      .then(function () {})
      .catch(function () {});

    return res.status(200).json({ messages: data || [] });
  } catch (err) {
    console.error('[getThread]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ============================================================
   ADMIN ENDPOINTS
   ============================================================ */

export async function listChats(req, res) {
  try {
    const { data: msgs, error } = await supabaseAdmin
      .from('messages')
      .select('id, user_id, sender, body, created_at, is_read')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      console.error('[listChats]', error);
      return res.status(500).json({ error: 'Could not load chats.' });
    }

    const byUser = {};
    (msgs || []).forEach(function (m) {
      if (!byUser[m.user_id]) {
        byUser[m.user_id] = {
          user_id: m.user_id,
          last_message: m.body,
          last_sender: m.sender,
          last_at: m.created_at,
          unread: 0,
        };
      }
      if (m.sender === 'user' && !m.is_read) {
        byUser[m.user_id].unread++;
      }
    });

    const userIds = Object.keys(byUser);
    if (!userIds.length) {
      return res.status(200).json({ chats: [] });
    }

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    const profileMap = {};
    (profiles || []).forEach(function (p) { profileMap[p.id] = p; });

    const chats = userIds.map(function (uid) {
      const info = byUser[uid];
      const prof = profileMap[uid] || {};
      return {
        user_id: uid,
        first_name: prof.first_name || '',
        last_name: prof.last_name || '',
        email: prof.email || '',
        last_message: info.last_message,
        last_sender: info.last_sender,
        last_at: info.last_at,
        unread: info.unread,
      };
    }).sort(function (a, b) {
      return new Date(b.last_at) - new Date(a.last_at);
    });

    return res.status(200).json({ chats: chats });
  } catch (err) {
    console.error('[listChats]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getChatThread(req, res) {
  try {
    const userId = req.params.userId;

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, sender, body, created_at, is_read')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(300);

    if (error) {
      console.error('[getChatThread]', error);
      return res.status(500).json({ error: 'Could not load messages.' });
    }

    await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('sender', 'user')
      .eq('is_read', false)
      .then(function () {})
      .catch(function () {});

    return res.status(200).json({ messages: data || [] });
  } catch (err) {
    console.error('[getChatThread]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function replyToUser(req, res) {
  try {
    const userId = req.params.userId;
    const body = (req.body && req.body.body) ? String(req.body.body).trim() : '';
    if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({ user_id: userId, sender: 'admin', body })
      .select()
      .single();

    if (error) {
      console.error('[replyToUser]', error);
      return res.status(500).json({ error: 'Could not send reply.' });
    }

    return res.status(201).json({ message: data });
  } catch (err) {
    console.error('[replyToUser]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function unreadCount(req, res) {
  try {
    const { count, error } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender', 'user')
      .eq('is_read', false);

    if (error) {
      return res.status(200).json({ unread: 0 });
    }
    return res.status(200).json({ unread: count || 0 });
  } catch (err) {
    return res.status(200).json({ unread: 0 });
  }
      }
