let cached = null // { token, expiresAt }

export async function getAppAccessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const url = new URL('https://id.twitch.tv/oauth2/token')
  url.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID)
  url.searchParams.set('client_secret', process.env.TWITCH_CLIENT_SECRET)
  url.searchParams.set('grant_type', 'client_credentials')

  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Failed to get Twitch app access token: ${await response.text()}`)
  }
  const data = await response.json()
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cached.token
}
