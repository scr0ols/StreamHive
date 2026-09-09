import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import 'dotenv/config';
import { pool } from './db.js';
import { getAppAccessToken } from './twitchAppToken.js';
import { getUserAccessToken, ReloginRequiredError } from './twitchUserToken.js';
import { assertEncryptionKeyConfigured, encryptToken } from './tokenCrypto.js';
import {
  FRONTEND_URL,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_REDIRECT_URI,
  twitchClientIdEnv,
  twitchClientSecretEnv,
  twitchRedirectUriEnv,
} from './env.js';

const { PORT = 3000 } = process.env;

// Fails fast (see TOKEN_ENCRYPTION_KEY in tokenCrypto.js) rather than only
// surfacing on the first login attempt. FRONTEND_URL/TWITCH_* env vars are
// validated as a side effect of importing ./env.js above.
assertEncryptionKeyConfigured();

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const OAUTH_NONCE_COOKIE = 'oauth_nonce';
const MAX_PENDING_STATES = 10_000;
const MAX_PENDING_STATES_PER_CLIENT = 5;
const MAX_TEMPLATES_PER_USER = 100;
const MAX_TEMPLATE_NAME_LENGTH = 100;
const MAX_CHANNEL_LOGIN_LENGTH = 50;
const PUBLIC_CACHE_TTL_MS = 10_000;
const PUBLIC_CACHE_MAX_ENTRIES = 100;
const MIN_CHANNELS = 1;
const MAX_CHANNELS = 6;
const AUDIO_MODES = ['selection', 'both'];

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

const oauthNonceCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/auth',
};

function createRateLimiter({ windowMs, max, keyGenerator = (req) => req.ip, maxKeys = 10_000 }) {
  const requestsByKey = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const timestamps = (requestsByKey.get(key) ?? []).filter((timestamp) => timestamp > now - windowMs);

    if (timestamps.length >= max) {
      requestsByKey.set(key, timestamps);
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    timestamps.push(now);
    requestsByKey.set(key, timestamps);

    if (requestsByKey.size > maxKeys) {
      const oldestKey = requestsByKey.keys().next().value;
      requestsByKey.delete(oldestKey);
    }

    next();
  };
}

function createJsonCache({ ttlMs, maxEntries }) {
  const cache = new Map();
  const inFlight = new Map();

  return async function getCached(key, loader) {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;
    if (cached) cache.delete(key);
    if (inFlight.has(key)) return inFlight.get(key);

    const pending = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (value?.status === 200) {
          cache.set(key, { value, expiresAt: Date.now() + ttlMs });
          while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        }
        return value;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  };
}

function getRequestOrigin(req) {
  const origin = req.get('origin');
  if (origin) return origin;
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function requireSameOrigin(req, res, next) {
  const requestOrigin = getRequestOrigin(req);
  const allowedOrigin = new URL(FRONTEND_URL).origin;
  if (requestOrigin !== allowedOrigin) {
    return res.status(403).json({ error: 'Cross-site state-changing request blocked.' });
  }
  next();
}

function cleanupPendingStates(pendingStates, now = Date.now()) {
  for (const [state, transaction] of pendingStates) {
    if (transaction.expiresAt <= now) pendingStates.delete(state);
  }
}

function templateValidationError(body) {
  const { name, channels, audioMode, activeChannel, volumes, chatBarOpen } = body ?? {};
  if (typeof name !== 'string' || !name.trim()) return 'name is required.';
  if (name.trim().length > MAX_TEMPLATE_NAME_LENGTH) {
    return `name must be ${MAX_TEMPLATE_NAME_LENGTH} characters or fewer.`;
  }
  if (!Array.isArray(channels) || channels.length < MIN_CHANNELS || channels.length > MAX_CHANNELS) {
    return `channels must be an array of ${MIN_CHANNELS}-${MAX_CHANNELS} entries.`;
  }
  if (channels.some((channel) =>
    !channel || typeof channel.loginName !== 'string' ||
    !channel.loginName.trim() || channel.loginName.trim().length > MAX_CHANNEL_LOGIN_LENGTH)) {
    return `each channel loginName must be a nonempty string of ${MAX_CHANNEL_LOGIN_LENGTH} characters or fewer.`;
  }
  if (!AUDIO_MODES.includes(audioMode)) return `audioMode must be one of: ${AUDIO_MODES.join(', ')}.`;
  if (activeChannel !== null && activeChannel !== undefined &&
      (typeof activeChannel !== 'string' || activeChannel.length > MAX_CHANNEL_LOGIN_LENGTH)) {
    return `activeChannel must be ${MAX_CHANNEL_LOGIN_LENGTH} characters or fewer.`;
  }
  if (volumes !== null && volumes !== undefined &&
      (typeof volumes !== 'object' || Array.isArray(volumes) || Object.keys(volumes).length > MAX_CHANNELS ||
       Object.keys(volumes).some((key) => key.length > MAX_CHANNEL_LOGIN_LENGTH) ||
       Object.values(volumes).some((volume) => !Number.isFinite(volume) || volume < 0 || volume > 100))) {
    return 'volumes must contain at most six numeric values from 0 to 100.';
  }
  if (chatBarOpen !== undefined && typeof chatBarOpen !== 'boolean') return 'chatBarOpen must be a boolean.';
  return null;
}

// The default logout contract is intentionally per-device: deleting the
// current session avoids surprising other active browsers. Global revocation
// remains available to future product flows with `DELETE FROM sessions WHERE
// user_id = $1` if the product later requires a "log out everywhere" action.
export function createApp({
  db = pool,
  fetchImpl = globalThis.fetch,
  getAppToken = getAppAccessToken,
  oauthStateTtlMs = OAUTH_STATE_TTL_MS,
  publicCacheTtlMs = PUBLIC_CACHE_TTL_MS,
  publicRateLimit = { windowMs: 60_000, max: 60 },
  loginRateLimit = { windowMs: 60_000, max: 10 },
  templateRateLimit = { windowMs: 60_000, max: 30 },
} = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: FRONTEND_URL, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));

  // OAuth state transactions are server-side and keyed by a nonce cookie, so
  // a state captured in another browser cannot be completed here. Sessions
  // remain Postgres-backed because they must survive backend restarts.
  const pendingStates = new Map();
  const publicCache = createJsonCache({ ttlMs: publicCacheTtlMs, maxEntries: PUBLIC_CACHE_MAX_ENTRIES });
  const publicProxyRateLimit = createRateLimiter(publicRateLimit);
  const loginStartRateLimit = createRateLimiter(loginRateLimit);
  const logoutRateLimit = createRateLimiter({ windowMs: 60_000, max: 30 });
  const templateWriteRateLimit = createRateLimiter({
    ...templateRateLimit,
    keyGenerator: (req) => `${req.ip}:${req.cookies.session_id ?? 'anonymous'}`,
  });

  async function requireAuth(req, res, next) {
  const sessionId = req.cookies.session_id;
  if (!sessionId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  const { rows } = await db.query('SELECT user_id, expires_at FROM sessions WHERE id = $1', [sessionId]);
  const session = rows[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
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

  app.get('/auth/twitch/login', loginStartRateLimit, (req, res) => {
  const now = Date.now();
  cleanupPendingStates(pendingStates, now);
  const clientKey = req.ip;
  const browserNonce = req.cookies[OAUTH_NONCE_COOKIE] || crypto.randomBytes(32).toString('hex');
  const outstandingForClient = [...pendingStates.values()].filter((transaction) =>
    transaction.clientKey === clientKey || transaction.nonce === browserNonce,
  ).length;
  if (outstandingForClient >= MAX_PENDING_STATES_PER_CLIENT || pendingStates.size >= MAX_PENDING_STATES) {
    return res.status(429).json({ error: 'Too many pending login attempts. Try again later.' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, {
    nonce: browserNonce,
    clientKey,
    expiresAt: now + oauthStateTtlMs,
  });

  const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  // user:read:follows powers /api/followed-streams; the only scope we request.
  authorizeUrl.searchParams.set('scope', 'user:read:follows');
  authorizeUrl.searchParams.set('state', state);

  res.cookie(OAUTH_NONCE_COOKIE, browserNonce, { ...oauthNonceCookieOptions, maxAge: oauthStateTtlMs });
  res.redirect(authorizeUrl.toString());
});

app.get('/auth/twitch/callback', async (req, res) => {
  const { code, state } = req.query;
  cleanupPendingStates(pendingStates);
  const transaction = state ? pendingStates.get(state) : null;

  if (!transaction || transaction.expiresAt <= Date.now()) {
    if (state) pendingStates.delete(state);
    return res.status(400).send('Invalid or expired OAuth state.');
  }
  if (req.cookies[OAUTH_NONCE_COOKIE] !== transaction.nonce) {
    return res.status(400).send('Invalid or mismatched OAuth transaction.');
  }
  pendingStates.delete(state);
  res.clearCookie(OAUTH_NONCE_COOKIE, oauthNonceCookieOptions);

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const tokenUrl = new URL('https://id.twitch.tv/oauth2/token');
  tokenUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  tokenUrl.searchParams.set('client_secret', TWITCH_CLIENT_SECRET);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('grant_type', 'authorization_code');
  tokenUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);

  const tokenResponse = await fetchImpl(tokenUrl, { method: 'POST' });
  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    // Twitch's error body itself never contains the secret, only the
    // outcome (e.g. "invalid client secret") — safe to log server-side.
    // The client-id/secret length + normalization flags are the fast way to
    // tell "wrong value" apart from "value got mangled in transit".
    console.error('Twitch token exchange failed:', {
      status: tokenResponse.status,
      body: body.slice(0, 500),
      clientIdLength: twitchClientIdEnv.length,
      clientIdWasNormalized: twitchClientIdEnv.wasNormalized,
      clientSecretLength: twitchClientSecretEnv.length,
      clientSecretWasNormalized: twitchClientSecretEnv.wasNormalized,
      redirectUriWasNormalized: twitchRedirectUriEnv.wasNormalized,
    });
    return res.redirect(`${FRONTEND_URL}?error=auth_failed`);
  }
  const tokens = await tokenResponse.json();

  const userResponse = await fetchImpl('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });
  if (!userResponse.ok) {
    const body = await userResponse.text();
    console.error('Twitch user lookup failed:', { status: userResponse.status, body: body.slice(0, 500) });
    return res.redirect(`${FRONTEND_URL}?error=auth_failed`);
  }
  const { data } = await userResponse.json();
  const twitchUser = data[0];

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { rows } = await db.query(
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
  await db.query(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [sessionId, userId, new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(), new Date().toISOString()],
  );

  res.cookie('session_id', sessionId, { ...sessionCookieOptions, maxAge: SESSION_MAX_AGE_MS });
  res.redirect(FRONTEND_URL);
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const { rows } = await db.query(
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

app.post('/auth/logout', logoutRateLimit, requireSameOrigin, async (req, res) => {
  await db.query('DELETE FROM sessions WHERE id = $1', [req.cookies.session_id]);
  res.clearCookie('session_id', sessionCookieOptions);
  res.status(204).end();
});

app.get('/api/stream-status', publicProxyRateLimit, async (req, res) => {
  const logins = String(req.query.logins || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);

  if (logins.length === 0) {
    return res.json({ online: [] });
  }

  const result = await publicCache(`stream-status:${logins.join(',')}`, async () => {
    const token = await getAppToken();
    const streamsUrl = new URL('https://api.twitch.tv/helix/streams');
    logins.forEach((login) => streamsUrl.searchParams.append('user_login', login));
    const streamsResponse = await fetchImpl(streamsUrl, {
      headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` },
    });
    if (streamsResponse.status === 429) return { status: 429, body: { error: 'Twitch rate limit hit.' } };
    if (!streamsResponse.ok) {
      const body = await streamsResponse.text();
      return { status: 502, body: { error: `Helix streams lookup failed: ${body}` } };
    }
    const { data } = await streamsResponse.json();
    return { status: 200, body: { online: data.map((stream) => stream.user_login.toLowerCase()) } };
  });
  res.status(result.status).json(result.body);
});

// Top live streams on Twitch, ordered by viewers by Helix. Public data, app
// token, no auth required and never persisted.
app.get('/api/trending-streams', publicProxyRateLimit, async (req, res) => {
  const result = await publicCache('trending-streams', async () => {
    const streamsUrl = new URL('https://api.twitch.tv/helix/streams');
    streamsUrl.searchParams.set('first', '12');
    const streamsResponse = await fetchImpl(streamsUrl, {
      headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${await getAppToken()}` },
    });
    if (streamsResponse.status === 429) return { status: 429, body: { error: 'Twitch rate limit hit.' } };
    if (!streamsResponse.ok) {
      const body = await streamsResponse.text();
      return { status: 502, body: { error: `Helix trending-streams lookup failed: ${body}` } };
    }
    const { data } = await streamsResponse.json();
    return {
      status: 200,
      body: { streams: data.map((s) => ({
        loginName: s.user_login.toLowerCase(),
        displayName: s.user_name,
        title: s.title,
        gameName: s.game_name,
        viewerCount: s.viewer_count,
      })) },
    };
  });
  res.status(result.status).json(result.body);
});

// Which of these logins exist on Twitch right now? Used to validate template
// channels on load (PLAN.md edge case 3). Public data, app token, no auth.
app.get('/api/resolve-channels', publicProxyRateLimit, async (req, res) => {
  const logins = String(req.query.logins || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);

  if (logins.length === 0) {
    return res.json({ found: [] });
  }

  const result = await publicCache(`resolve-channels:${logins.join(',')}`, async () => {
    const token = await getAppToken();
    const usersUrl = new URL('https://api.twitch.tv/helix/users');
    logins.forEach((login) => usersUrl.searchParams.append('login', login));
    const usersResponse = await fetchImpl(usersUrl, {
      headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` },
    });
    if (usersResponse.status === 429) return { status: 429, body: { error: 'Twitch rate limit hit.' } };
    if (!usersResponse.ok) {
      const body = await usersResponse.text();
      return { status: 502, body: { error: `Helix users lookup failed: ${body}` } };
    }
    const { data } = await usersResponse.json();
    return { status: 200, body: { found: data.map((user) => user.login.toLowerCase()) } };
  });
  res.status(result.status).json(result.body);
});

// Live channels the logged-in user follows, straight from Helix with the
// user's own token (requires the user:read:follows scope). Passed through,
// never persisted.
app.get('/api/followed-streams', publicProxyRateLimit, requireAuth, async (req, res) => {
  async function forceRelogin() {
    await db.query('DELETE FROM sessions WHERE id = $1', [req.cookies.session_id]);
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

  const { rows } = await db.query('SELECT twitch_id FROM users WHERE id = $1', [req.userId]);
  const streamsUrl = new URL('https://api.twitch.tv/helix/streams/followed');
  streamsUrl.searchParams.set('user_id', rows[0].twitch_id);
  streamsUrl.searchParams.set('first', '100');

  const streamsResponse = await fetchImpl(streamsUrl, {
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

app.get('/api/templates', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM templates WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.userId],
  );
  res.json(rows.map(serializeTemplate));
});

app.post('/api/templates', templateWriteRateLimit, requireSameOrigin, requireAuth, async (req, res) => {
  const validationError = templateValidationError(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, channels, audioMode, activeChannel, volumes, chatBarOpen } = req.body;
  const { rows: countRows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM templates WHERE user_id = $1',
    [req.userId],
  );
  if (Number(countRows[0]?.count ?? 0) >= MAX_TEMPLATES_PER_USER) {
    return res.status(429).json({ error: 'Template quota reached.' });
  }
  const now = new Date().toISOString();
  const { rows } = await db.query(
    `INSERT INTO templates (id, user_id, name, channels, audio_mode, active_channel, volumes, chat_bar_open, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [
      crypto.randomUUID(),
      req.userId,
      name.trim(),
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
  const { rows } = await db.query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(serializeTemplate(rows[0]));
});

app.put('/api/templates/:id', templateWriteRateLimit, requireSameOrigin, requireAuth, async (req, res) => {
  const validationError = templateValidationError(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, channels, audioMode, activeChannel, volumes, chatBarOpen } = req.body;
  const now = new Date().toISOString();
  const { rows } = await db.query(
    `UPDATE templates
     SET name = $1, channels = $2, audio_mode = $3, active_channel = $4,
         volumes = $5, chat_bar_open = $6, updated_at = $7
     WHERE id = $8 AND user_id = $9
     RETURNING *`,
    [
      name.trim(),
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

app.delete('/api/templates/:id', templateWriteRateLimit, requireSameOrigin, requireAuth, async (req, res) => {
  const { rowCount } = await db.query(
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
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

  return app;
}

const app = createApp();
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

export { app };
