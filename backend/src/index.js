import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import 'dotenv/config';

const {
  PORT = 3000,
  FRONTEND_URL,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_REDIRECT_URI,
} = process.env;

const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(cookieParser());

// Day 2 spike: sessions and OAuth states live in memory, replaced by
// Postgres-backed storage on Day 3 (see c-docs/PLAN.md section 3.2).
const sessions = new Map();
const pendingStates = new Set();

app.get('/auth/twitch/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);

  const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', '');
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

  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, {
    twitchId: twitchUser.id,
    login: twitchUser.login,
    displayName: twitchUser.display_name,
    avatarUrl: twitchUser.profile_image_url,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });

  res.cookie('session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  res.redirect(FRONTEND_URL);
});

app.get('/auth/me', (req, res) => {
  const session = sessions.get(req.cookies.session_id);
  if (!session) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  res.json({
    login: session.login,
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
  });
});

app.post('/auth/logout', (req, res) => {
  sessions.delete(req.cookies.session_id);
  res.clearCookie('session_id');
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
