import { useEffect, useState } from 'react'
import { IconChat, IconChevronRight, IconVolumeOn } from './icons'
import { getTheme, THEME_CHANGE_EVENT } from '../settings'

// Match the Twitch chat iframe theme to the app's resolved theme (stored
// override first, prefers-color-scheme only as the 'system' fallback —
// same resolution settings.js/index.css use).
function resolveDark() {
  const theme = getTheme()
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function chatSrc(loginName, dark) {
  const params = new URLSearchParams({ parent: window.location.hostname })
  if (dark) params.set('darkpopout', '')
  return `https://www.twitch.tv/embed/${loginName}/chat?${params}`
}

// Every chat iframe stays mounted for the entire session: switching tabs (or
// collapsing the bar) only toggles CSS classes. Never turn these into a
// conditional {condition && <iframe/>} render — unmounting reloads the chat
// on every switch. Verified against multitwitch.tv, see c-docs/NOTES.md.
//
// Theme is the one deliberate exception: `dark` is real state, so a theme
// change (rare, explicit) does update `src` and reload the already-mounted
// chats — unlike tab/audio switching, which stays reload-free.
export default function ChatBar({
  channels,
  activeChatChannelId,
  activeAudioChannelId,
  open,
  onSelectChat,
  onToggle,
}) {
  const [dark, setDark] = useState(resolveDark)

  useEffect(() => {
    function handleThemeChange() {
      setDark(resolveDark())
    }
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange)
  }, [])

  return (
    <aside className={`chat-bar${open ? '' : ' collapsed'}`}>
      <button
        type="button"
        className="chat-bar-toggle"
        onClick={onToggle}
        title={open ? 'Collapse chat' : 'Expand chat'}
        aria-label={open ? 'Collapse chat' : 'Expand chat'}
        aria-expanded={open}
      >
        {open ? <IconChevronRight /> : <IconChat />}
      </button>

      <div className="chat-bar-body">
        <div className="chat-tabs" role="tablist" aria-label="Channel chats">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              role="tab"
              aria-selected={channel.id === activeChatChannelId}
              className={`chat-tab${channel.id === activeChatChannelId ? ' active' : ''}`}
              onClick={() => onSelectChat(channel.id)}
            >
              <span className="chat-tab-name">{channel.loginName}</span>
              {channel.id === activeAudioChannelId && <IconVolumeOn size={12} className="chat-tab-audio" />}
            </button>
          ))}
        </div>

        <div className="chat-panels">
          {channels.map((channel) => (
            <div
              key={channel.id}
              role="tabpanel"
              className={`chat-panel${channel.id === activeChatChannelId ? ' visible' : ''}`}
            >
              <iframe
                src={chatSrc(channel.loginName, dark)}
                title={`${channel.loginName} chat`}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
