import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import 'dotenv/config';
import { pool } from './db.js';
import { getAppAccessToken } from './twitchAppToken.js';
import { getUserAccessToken, ReloginRequiredError } from './twitchUserToken.js';
import { assertEncryptionKeyConfigured, encryptToken } from './tokenCrypto.js';

const {
  PORT = 3000,
  FRONTEND_URL,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_REDIRECT_URI,
} = process.env;

if (!FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not set — refusing to start with cors() defaulting to origin "*"');
}
// Fails fast (see TOKEN_ENCRYPTION_KEY in tokenCrypto.js) rather than only
// surfacing on the first login attempt.
assertEncryptionKeyConfigured();

const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// OAuth states are short-lived (round-trip of a single login attempt), stay
// in memory. Sessions map a session_id cookie to a users.id and must
// survive a backend restart, so they're Postgres-backed (see `sessions`
// table) with expires_at mirroring the cookie's maxAge below.
const pendingStates = new Set();
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

// Local dev has frontend and backend on the same site (both localhost, http),
// so the default lax/insecure cookie is sent fine. In production they're on
// different domains (Vercel + Render), which is a cross-site request from
// the browser's perspective — that requires SameSite=None, and browsers
// only honor SameSite=None on a Secure (https-only) cookie. NODE_ENV=production
// must be set in the deployed backend's environment for this to switch over.
const isProduction = process.env.NODE_ENV === 'production';
const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
};

async function requireAuth(req, res, next) {
  const sessionId = req.cookies.session_id;
  if (!sessionId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  const { rows } = await pool.query('SELECT user_id, expires_at FROM sessions WHERE id = $1', [sessionId]);
  const session = rows[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    return res.status(401).json({ error: 'Not logged in.' });
  }

  req.userId = session.user_id;
  next();
}

function serializeTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    channels: JSON.parse(row.channels),
    audioMode: row.audio_mode,
    activeChannel: row.active_channel,
    volumes: row.volumes ? JSON.parse(row.volumes) : null,
    chatBarOpen: Boolean(row.chat_bar_open),
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get('/auth/twitch/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);

  const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  // user:read:follows powers /api/followed-streams; the only scope we request.
  authorizeUrl.searchParams.set('scope', 'user:read:follows');
  authorizeUrl.searchParams.set('state', state);

  res.redirect(authorizeUrl.toString());
});

app.get('/auth/twitch/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('Invalid or missing OAuth state.');
  }
  pendingStates.delete(state);

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const tokenUrl = new URL('https://id.twitch.tv/oauth2/token');
  tokenUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  tokenUrl.searchParams.set('client_secret', TWITCH_CLIENT_SECRET);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('grant_type', 'authorization_code');
  tokenUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);

  const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    return res.status(502).send(`Token exchange failed: ${body}`);
  }
  const tokens = await tokenResponse.json();

  const userResponse = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });
  if (!userResponse.ok) {
    const body = await userResponse.text();
    return res.status(502).send(`User lookup failed: ${body}`);
  }
  const { data } = await userResponse.json();
  const twitchUser = data[0];

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { rows } = await pool.query(
    `INSERT INTO users (id, twitch_id, login, display_name, avatar_url, access_token, refresh_token, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (twitch_id) DO UPDATE SET
       login = EXCLUDED.login,
       display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at
     RETURNING id`,
    [
      crypto.randomUUID(),
      twitchUser.id,
      twitchUser.login,
      twitchUser.display_name,
      twitchUser.profile_image_url,
      encryptToken(tokens.access_token),
      encryptToken(tokens.refresh_token),
      expiresAt,
      now,
    ],
  );
  const userId = rows[0].id;

  const sessionId = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [sessionId, userId, new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(), new Date().toISOString()],
  );

  res.cookie('session_id', sessionId, { ...sessionCookieOptions, maxAge: SESSION_MAX_AGE_MS });
  res.redirect(FRONTEND_URL);
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT login, display_name, avatar_url FROM users WHERE id = $1',
    [req.userId],
  );
  const user = rows[0];
  res.json({
    login: user.login,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  });
});

app.post('/auth/logout', async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE id = $1', [req.cookies.session_id]);
  res.clearCookie('session_id', sessionCookieOptions);
  res.status(204).end();
});

app.get('/api/stream-status', async (req, res) => {
  const logins = String(req.query.logins || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);

  if (logins.length === 0) {
    return res.json({ online: [] });
  }

  const token = await getAppAccessToken();
  const streamsUrl = new URL('https://api.twitch.tv/helix/streams');
  logins.forEach((login) => streamsUrl.searchParams.append('user_login', login));

  const streamsResponse = await fetch(streamsUrl, {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });
  if (streamsResponse.status === 429) {
    return res.status(429).json({ error: 'Twitch rate limit hit.' });
  }
  if (!streamsResponse.ok) {
    const body = await streamsResponse.text();
    return res.status(502).json({ error: `Helix streams lookup failed: ${body}` });
  }
  const { data } = await streamsResponse.json();
  res.json({ online: data.map((stream) => stream.user_login.toLowerCase()) });
});

// Top live streams on Twitch, ordered by viewers by Helix. Public data, app
// token, no auth required and never persisted.
app.get('/api/trending-streams', async (req, res) => {
  const streamsUrl = new URL('https://api.twitch.tv/helix/streams');
  streamsUrl.searchParams.set('first', '12');

  const streamsResponse = await fetch(streamsUrl, {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${await getAppAccessToken()}`,
    },
  });
  if (streamsResponse.status === 429) {
    return res.status(429).json({ error: 'Twitch rate limit hit.' });
  }
  if (!streamsResponse.ok) {
    const body = await streamsResponse.text();
    return res.status(502).json({ error: `Helix trending-streams lookup failed: ${body}` });
  }
  const { data } = await streamsResponse.json();
  res.json({
    streams: data.map((s) => ({
      loginName: s.user_login.toLowerCase(),
      displayName: s.user_name,
      title: s.title,
      gameName: s.game_name,
      viewerCount: s.viewer_count,
    })),
  });
});

// Which of these logins exist on Twitch right now? Used to validate template
// channels on load (PLAN.md edge case 3). Public data, app token, no auth.
app.get('/api/resolve-channels', async (req, res) => {
  const logins = String(req.query.logins || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);

  if (logins.length === 0) {
    return res.json({ found: [] });
  }

  const token = await getAppAccessToken();
  const usersUrl = new URL('https://api.twitch.tv/helix/users');
  logins.forEach((login) => usersUrl.searchParams.append('login', login));

  const usersResponse = await fetch(usersUrl, {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });
  if (usersResponse.status === 429) {
    return res.status(429).json({ error: 'Twitch rate limit hit.' });
  }
  if (!usersResponse.ok) {
    const body = await usersResponse.text();
    return res.status(502).json({ error: `Helix users lookup failed: ${body}` });
  }
  const { data } = await usersResponse.json();
  res.json({ found: data.map((user) => user.login.toLowerCase()) });
});

// Live channels the logged-in user follows, straight from Helix with the
// user's own token (requires the user:read:follows scope). Passed through,
// never persisted.
app.get('/api/followed-streams', requireAuth, async (req, res) => {
  async function forceRelogin() {
    await pool.query('DELETE FROM sessions WHERE id = $1', [req.cookies.session_id]);
    res.clearCookie('session_id', sessionCookieOptions);
    res.status(401).json({ error: 'Session expired, log in again.' });
  }

  let token;
  try {
    token = await getUserAccessToken(req.userId);
  } catch (err) {
    if (err instanceof ReloginRequiredError) return forceRelogin();
    throw err;
  }

  const { rows } = await pool.query('SELECT twitch_id FROM users WHERE id = $1', [req.userId]);
  const streamsUrl = new URL('https://api.twitch.tv/helix/streams/followed');
  streamsUrl.searchParams.set('user_id', rows[0].twitch_id);
  streamsUrl.searchParams.set('first', '100');

  const streamsResponse = await fetch(streamsUrl, {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });
  // 401/403 with a live token means it predates the user:read:follows scope
  // (or access was revoked): force a re-login so the scope gets granted.
  if (streamsResponse.status === 401 || streamsResponse.status === 403) {
    return forceRelogin();
  }
  if (streamsResponse.status === 429) {
    return res.status(429).json({ error: 'Twitch rate limit hit.' });
  }
  if (!streamsResponse.ok) {
    const body = await streamsResponse.text();
    return res.status(502).json({ error: `Helix followed-streams lookup failed: ${body}` });
  }
  const { data } = await streamsResponse.json();
  res.json({
    streams: data.map((s) => ({
      loginName: s.user_login.toLowerCase(),
      displayName: s.user_name,
      title: s.title,
      gameName: s.game_name,
      viewerCount: s.viewer_count,
    })),
  });
});

// Mirrors frontend/src/gridReducer.js's MIN_CHANNELS/MAX_CHANNELS and
// audioMode values — kept in sync manually since frontend and backend are
// separate apps with no shared package.
const MIN_CHANNELS = 2;
const MAX_CHANNELS = 6;
const AUDIO_MODES = ['selection', 'both'];

function templateValidationError(body) {
  const { name, channels, audioMode } = body;
  if (typeof name !== 'string' || !name.trim()) return 'name is required.';
  if (!Array.isArray(channels) || channels.length < MIN_CHANNELS || channels.length > MAX_CHANNELS) {
    return `channels must be an array of ${MIN_CHANNELS}-${MAX_CHANNELS} entries.`;
  }
  if (!AUDIO_MODES.includes(audioMode)) return `audioMode must be one of: ${AUDIO_MODES.join(', ')}.`;
  return null;
}

app.get('/api/templates', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM templates WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.userId],
  );
  res.json(rows.map(serializeTemplate));
});

app.post('/api/templates', requireAuth, async (req, res) => {
  const validationError = templateValidationError(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, channels, audioMode, activeChannel, volumes, chatBarOpen } = req.body;
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO templates (id, user_id, name, channels, audio_mode, active_channel, volumes, chat_bar_open, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [
      crypto.randomUUID(),
      req.userId,
      name,
      JSON.stringify(channels),
      audioMode,
      activeChannel ?? null,
      volumes ? JSON.stringify(volumes) : null,
      chatBarOpen ? 1 : 0,
      now,
    ],
  );
  res.status(201).json(serializeTemplate(rows[0]));
});

app.get('/api/templates/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(serializeTemplate(rows[0]));
});

app.put('/api/templates/:id', requireAuth, async (req, res) => {
  const validationError = templateValidationError(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, channels, audioMode, activeChannel, volumes, chatBarOpen } = req.body;
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE templates
     SET name = $1, channels = $2, audio_mode = $3, active_channel = $4,
         volumes = $5, chat_bar_open = $6, updated_at = $7
     WHERE id = $8 AND user_id = $9
     RETURNING *`,
    [
      name,
      JSON.stringify(channels),
      audioMode,
      activeChannel ?? null,
      volumes ? JSON.stringify(volumes) : null,
      chatBarOpen ? 1 : 0,
      now,
      req.params.id,
      req.userId,
    ],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(serializeTemplate(rows[0]));
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM templates WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId],
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found.' });
  res.status(204).end();
});

// Express 5 forwards rejected async route handlers here automatically.
// Without this, an unhandled error returns Express's default HTML error
// page, which the frontend's `!res.ok` check treats as an opaque failure
// with no diagnostic. Log the real cause and return JSON instead.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
