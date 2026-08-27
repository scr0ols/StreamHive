// Self-sufficient for .env loading: this module can be the first thing that
// touches process.env (e.g. when twitchAppToken.js imports it before
// index.js's own `import 'dotenv/config'` would otherwise run), so it loads
// dotenv itself rather than relying on import order in whichever file
// imports it first. A no-op in production, where real env vars are already
// set and there's no .env file to find.
import 'dotenv/config';

// Dashboards (Render, etc.) make it easy to paste an env var with leading/
// trailing whitespace or with the surrounding quotes still attached. Both
// are silently wrong: a padded/quoted TWITCH_CLIENT_SECRET is sent to Twitch
// as-is and comes back as an opaque "invalid client secret" with no hint
// that the value itself was ever mangled. Normalize once here so every
// consumer imports the clean value, and keep enough metadata (length,
// whether normalization changed anything) to log a useful diagnostic later
// without ever logging the secret itself.
function readEnvVar(name) {
  const raw = process.env[name];
  if (raw === undefined) return { value: undefined, wasNormalized: false, length: 0 };

  let value = raw.trim();
  const isQuoted =
    value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
  if (isQuoted) value = value.slice(1, -1);

  return { value: value || undefined, wasNormalized: value !== raw, length: value.length };
}

export const frontendUrlEnv = readEnvVar('FRONTEND_URL');
export const twitchClientIdEnv = readEnvVar('TWITCH_CLIENT_ID');
export const twitchClientSecretEnv = readEnvVar('TWITCH_CLIENT_SECRET');
export const twitchRedirectUriEnv = readEnvVar('TWITCH_REDIRECT_URI');

export const FRONTEND_URL = frontendUrlEnv.value;
export const TWITCH_CLIENT_ID = twitchClientIdEnv.value;
export const TWITCH_CLIENT_SECRET = twitchClientSecretEnv.value;
export const TWITCH_REDIRECT_URI = twitchRedirectUriEnv.value;

if (!FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not set — refusing to start with cors() defaulting to origin "*"');
}
// Without these, TWITCH_CLIENT_SECRET (etc.) reaches Twitch as the literal
// string "undefined" and the failure only surfaces as a 403 from Twitch on
// the first login attempt, with no clue it was a missing env var here.
for (const [name, env] of Object.entries({
  TWITCH_CLIENT_ID: twitchClientIdEnv,
  TWITCH_CLIENT_SECRET: twitchClientSecretEnv,
  TWITCH_REDIRECT_URI: twitchRedirectUriEnv,
})) {
  if (!env.value) {
    throw new Error(`${name} is not set — refusing to start (Twitch OAuth would fail with an opaque error).`);
  }
}
