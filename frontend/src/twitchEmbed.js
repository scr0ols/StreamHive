let scriptPromise = null

export function loadTwitchEmbedScript() {
  if (window.Twitch?.Embed) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://embed.twitch.tv/embed/v1.js'
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })
  return scriptPromise
}
