import { pool } from './db.js'
import { encryptToken, decryptToken } from './tokenCrypto.js'

// Thrown when the user's tokens can't produce a valid access token anymore
// (refresh token revoked/invalid). Callers clear the session and force a
// clean re-login, per PLAN.md edge case 7.
export class ReloginRequiredError extends Error {}

// A stored token that fails to decrypt is either corrupt or (during the
// encryption rollout) a plaintext row written before this module started
// encrypting on write. Either way there's no valid token to recover, so
// treat it the same as an expired/revoked one: force a clean re-login,
// which naturally re-encrypts on the next OAuth callback.
function decryptStoredToken(stored) {
  try {
    return decryptToken(stored)
  } catch {
    throw new ReloginRequiredError('Stored token could not be decrypted.')
  }
}

// Twitch rotates refresh tokens on use, so two concurrent refreshes for the
// same user would race: the first consumes the stored refresh_token and
// succeeds, the second gets rejected (already-consumed token) and forces a
// spurious re-login. De-dupe concurrent refreshes per user so a second
// caller awaits the first's in-flight refresh instead of starting its own.
const refreshesInFlight = new Map()

async function refreshAccessToken(userId, refreshToken) {
  const url = new URL('https://id.twitch.tv/oauth2/token')
  url.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID)
  url.searchParams.set('client_secret', process.env.TWITCH_CLIENT_SECRET)
  url.searchParams.set('grant_type', 'refresh_token')
  url.searchParams.set('refresh_token', refreshToken)

  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) {
    throw new ReloginRequiredError('Token refresh failed.')
  }
  const tokens = await response.json()

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await pool.query(
    'UPDATE users SET access_token = $1, refresh_token = $2, expires_at = $3 WHERE id = $4',
    [encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), expiresAt, userId],
  )
  return tokens.access_token
}

// Returns a valid access token for the user, refreshing it (and persisting
// the rotated token pair, Twitch rotates refresh tokens too) when the stored
// one is expired or about to expire.
export async function getUserAccessToken(userId) {
  const { rows } = await pool.query(
    'SELECT access_token, refresh_token, expires_at FROM users WHERE id = $1',
    [userId],
  )
  const user = rows[0]
  if (!user) throw new ReloginRequiredError('User not found.')

  if (new Date(user.expires_at).getTime() - Date.now() > 60_000) {
    return decryptStoredToken(user.access_token)
  }

  if (refreshesInFlight.has(userId)) {
    return refreshesInFlight.get(userId)
  }

  const refreshPromise = refreshAccessToken(userId, decryptStoredToken(user.refresh_token)).finally(() => {
    refreshesInFlight.delete(userId)
  })
  refreshesInFlight.set(userId, refreshPromise)
  return refreshPromise
}
