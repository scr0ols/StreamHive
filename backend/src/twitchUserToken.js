import { pool } from './db.js'

// Thrown when the user's tokens can't produce a valid access token anymore
// (refresh token revoked/invalid). Callers clear the session and force a
// clean re-login, per PLAN.md edge case 7.
export class ReloginRequiredError extends Error {}

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
    return user.access_token
  }

  const url = new URL('https://id.twitch.tv/oauth2/token')
  url.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID)
  url.searchParams.set('client_secret', process.env.TWITCH_CLIENT_SECRET)
  url.searchParams.set('grant_type', 'refresh_token')
  url.searchParams.set('refresh_token', user.refresh_token)

  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) {
    throw new ReloginRequiredError('Token refresh failed.')
  }
  const tokens = await response.json()

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await pool.query(
    'UPDATE users SET access_token = $1, refresh_token = $2, expires_at = $3 WHERE id = $4',
    [tokens.access_token, tokens.refresh_token, expiresAt, userId],
  )
  return tokens.access_token
}
