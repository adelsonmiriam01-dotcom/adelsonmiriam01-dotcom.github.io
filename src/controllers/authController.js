import { supabasePublic, supabaseAdmin } from '../config/supabase.js';
import { validateSignupPayload, validateLoginPayload } from '../utils/validation.js';

/**
 * POST /api/auth/signup
 * Creates a new user via Supabase Auth and stores the profile in public.profiles.
 */
export async function signup(req, res) {
  try {
    const { valid, errors, data } = validateSignupPayload(req.body);

    if (!valid) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    const { firstName, lastName, email, phone, password } = data;

    // 1. Create the Supabase Auth user with metadata.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for demo; set to false to require email verification.
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone,
      },
    });

    if (authError) {
      // Supabase returns a generic message for existing users when confirmations are on.
      const msg = authError.message || 'Could not create account.';
      const friendly = msg.toLowerCase().includes('already')
        ? 'An account with this email already exists.'
        : msg;
      return res.status(409).json({ error: friendly });
    }

    const userId = authData.user.id;

    // 2. Create a profile row in public.profiles.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      });

    if (profileError) {
      console.error('[signup] profile insert failed:', profileError);
      // Roll back the auth user so the email isn't stuck.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Could not save profile. Please try again.' });
    }

    // 3. Sign the user in to get a session token.
    const { data: sessionData, error: sessionError } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      // Account was created; session failed. Return success so the client can log in manually.
      return res.status(201).json({
        message: 'Account created. Please log in.',
        user: { id: userId, email, firstName, lastName },
      });
    }

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        phone,
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[signup]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/auth/login
 * Signs a user in with email + password.
 */
export async function login(req, res) {
  try {
    const { valid, errors, data } = validateLoginPayload(req.body);

    if (!valid) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    const { email, password } = data;

    const { data: sessionData, error: sessionError } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      // Do not reveal whether the email exists.
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Fetch the profile for the response.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', sessionData.user.id)
      .maybeSingle();

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        firstName: profile?.first_name || sessionData.user.user_metadata?.first_name || '',
        lastName: profile?.last_name || sessionData.user.user_metadata?.last_name || '',
        phone: profile?.phone || sessionData.user.user_metadata?.phone || '',
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/auth/refresh
 * Exchanges a refresh token for a new access token.
 */
export async function refresh(req, res) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required.' });
    }

    const { data, error } = await supabasePublic.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    return res.status(200).json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[refresh]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 * Protected by requireAuth middleware.
 */
export async function getMe(req, res) {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, phone, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[getMe]', error);
      return res.status(500).json({ error: 'Could not fetch profile.' });
    }

    return res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        phone: profile?.phone || '',
        createdAt: profile?.created_at || null,
      },
    });
  } catch (err) {
    console.error('[getMe]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/auth/logout
 * Signs the user out (invalidates the session server-side).
 */
export async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Best-effort server-side invalidation.
      await supabaseAdmin.auth.admin.signOut(token).catch(() => {});
    }
    return res.status(200).json({ message: 'Logged out.' });
  } catch (err) {
    console.error('[logout]', err);
    return res.status(200).json({ message: 'Logged out.' });
  }
}

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email via Supabase.
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const { error } = await supabasePublic.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CLIENT_URL}/reset-password`,
    });

    if (error) {
      console.error('[forgotPassword]', error);
    }

    // Always return success to avoid revealing whether the email exists.
    return res.status(200).json({
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  } catch (err) {
    console.error('[forgotPassword]', err);
    return res.status(200).json({
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  }
}
