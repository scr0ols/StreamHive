import { IconChat, IconChevronRight, IconVolumeOn } from './icons'

// Match the Twitch chat iframe theme to the app theme once at load; the
// param only takes effect at iframe creation anyway.
const dark = window.matchMedia('(prefers-color-scheme: dark)').matches

function chatSrc(loginName) {
  const params = new URLSearchParams({ parent: window.location.hostname })
  if (dark) params.set('darkpopout', '')
  return `https://www.twitch.tv/embed/${loginName}/chat?${params}`
}

// Every chat iframe stays mounted for the entire session: switching tabs (or
// collapsing the bar) only toggles CSS classes. Never turn these into a
// conditional {condition && <iframe/>} render — unmounting reloads the chat
// on every switch. Verified against multitwitch.tv, see c-docs/NOTES.md.
export default function ChatBar({
  channels,
  activeChatChannelId,
  activeAudioChannelId,
  open,
  onSelectChat,
  onToggle,
}) {
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
                src={chatSrc(channel.loginName)}
                title={`${channel.loginName} chat`}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
