const AUDIO_MODE_KEY = 'streamhive:defaultAudioMode'
const CHAT_BAR_KEY = 'streamhive:defaultChatBarOpen'
const THEME_KEY = 'streamhive:theme'

export function getDefaultAudioMode() {
  return localStorage.getItem(AUDIO_MODE_KEY) === 'both' ? 'both' : 'selection'
}

export function setDefaultAudioMode(mode) {
  localStorage.setItem(AUDIO_MODE_KEY, mode)
}

export function getDefaultChatBarOpen() {
  const stored = localStorage.getItem(CHAT_BAR_KEY)
  return stored === null ? true : stored === 'true'
}

export function setDefaultChatBarOpen(open) {
  localStorage.setItem(CHAT_BAR_KEY, String(open))
}

export function getTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

// 'system' clears the override so the prefers-color-scheme media query in
// index.css takes back over; 'light'/'dark' set data-theme, which wins
// against that media query since its rules come later in source order.
export function setTheme(theme) {
  if (theme === 'system') {
    localStorage.removeItem(THEME_KEY)
    document.documentElement.removeAttribute('data-theme')
  } else {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.setAttribute('data-theme', theme)
  }
}

// Call once before the first paint so a stored override doesn't flash the
// system theme first.
export function applyStoredTheme() {
  const theme = getTheme()
  if (theme !== 'system') document.documentElement.setAttribute('data-theme', theme)
}
