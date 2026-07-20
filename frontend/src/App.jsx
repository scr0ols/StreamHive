import { useEffect, useReducer, useRef, useState } from 'react'
import { gridReducer, initialGridState, MIN_CHANNELS } from './gridReducer'
import AddChannelForm from './components/AddChannelForm'
import AudioModeControl from './components/AudioModeControl'
import VideoGrid from './components/VideoGrid'
import ChatBar from './components/ChatBar'
import TemplateManager from './components/TemplateManager'
import FollowedLive from './components/FollowedLive'
import { IconTwitch, LogoMark } from './components/icons'
import './App.css'

const BACKEND_URL = 'http://localhost:3000'

function App() {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)
  const [loginPrompt, setLoginPrompt] = useState(null)
  const [state, dispatch] = useReducer(gridReducer, initialGridState)

  // Dev-only hook: lets browser automation drive the reducer directly (e.g.
  // to exercise SET_STATE without an authenticated session). Stripped from
  // production builds.
  useEffect(() => {
    if (import.meta.env.DEV) window.__streamhive = { dispatch }
  }, [])

  useEffect(() => {
    fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .finally(() => setChecked(true))
  }, [])

  const channelsRef = useRef(state.channels)
  channelsRef.current = state.channels

  const logins = state.channels.map((c) => c.loginName).join(',')
  useEffect(() => {
    if (!logins) return

    async function pollStreamStatus() {
      const res = await fetch(`${BACKEND_URL}/api/stream-status?logins=${logins}`)
      if (!res.ok) return
      const { online } = await res.json()
      const onlineSet = new Set(online)
      channelsRef.current.forEach((channel) => {
        dispatch({ type: 'SET_CHANNEL_ONLINE', id: channel.id, online: onlineSet.has(channel.loginName) })
      })
    }

    pollStreamStatus()
    const interval = setInterval(pollStreamStatus, 30000)
    return () => clearInterval(interval)
  }, [logins])

  function login() {
    window.location.href = `${BACKEND_URL}/auth/twitch/login`
  }

  function logout() {
    fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).then(() => setUser(null))
  }

  // Follow is Twitch's own native mechanism (Helix has no follow endpoint
  // anymore), so following happens on the channel page itself — but the
  // action is gated behind a StreamHive login, per the PRD.
  function handleFollow(channel) {
    if (!user) {
      setLoginPrompt(`Log in with Twitch to follow ${channel.loginName}.`)
      return
    }
    window.open(`https://www.twitch.tv/${channel.loginName}`, '_blank', 'noopener')
  }

  // Template load: validate the saved logins against Helix first (PLAN.md
  // edge case 3); unresolvable ones render a "channel not found" panel. If
  // the validation call itself fails, load anyway without flags.
  async function loadTemplate(template) {
    const orderedChannels = [...template.channels].sort((a, b) => a.order - b.order)
    const logins = orderedChannels.map((c) => c.loginName)

    let foundSet = null
    const res = await fetch(`${BACKEND_URL}/api/resolve-channels?logins=${logins.join(',')}`).catch(() => null)
    if (res?.ok) {
      const { found } = await res.json()
      foundSet = new Set(found)
    }

    dispatch({
      type: 'SET_STATE',
      channels: orderedChannels.map((c) => ({
        loginName: c.loginName,
        exists: foundSet ? foundSet.has(c.loginName) : undefined,
      })),
      audioMode: template.audioMode,
      activeChannel: template.activeChannel,
      volumes: template.volumes,
      chatBarOpen: template.chatBarOpen,
    })
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="brand">
          <LogoMark />
          <span className="brand-name">StreamHive</span>
        </div>
        <div className="topbar-controls">
          <TemplateManager
            user={user}
            gridState={state}
            onLoadTemplate={loadTemplate}
            onLogin={login}
            onSessionExpired={() => setUser(null)}
          />
          <AddChannelForm
            channelCount={state.channels.length}
            onAdd={(loginName) => dispatch({ type: 'ADD_CHANNEL', loginName })}
          />
        </div>
        {checked && (
          <div className="auth-bar">
            {user && (
              <FollowedLive
                channels={state.channels}
                onAdd={(loginName) => dispatch({ type: 'ADD_CHANNEL', loginName })}
                onSessionExpired={() => setUser(null)}
              />
            )}
            {user && (
              <span className="auth-account">
                <img className="auth-avatar" src={user.avatarUrl} alt="" width={28} height={28} />
                <span className="auth-name">{user.displayName}</span>
              </span>
            )}
            <AudioModeControl
              audioMode={state.audioMode}
              onSetAudioMode={(mode) => dispatch({ type: 'SET_AUDIO_MODE', mode })}
            />
            {user ? (
              <button type="button" className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            ) : (
              <button type="button" className="btn btn-twitch" onClick={login}>
                <IconTwitch />
                <span>Log in with Twitch</span>
              </button>
            )}
          </div>
        )}
      </header>

      <div className="app-main">
        <main className="stage">
          {state.channels.length < MIN_CHANNELS ? (
            <div className="empty-state">
              <LogoMark size={40} className="empty-state-mark" />
              <p className="empty-state-title">Watch up to 5 streams at once</p>
              <p>Add at least {MIN_CHANNELS} channels to start viewing.</p>
            </div>
          ) : (
            <VideoGrid
              channels={state.channels}
              audioMode={state.audioMode}
              activeAudioChannelId={state.activeAudioChannelId}
              volumes={state.volumes}
              onOnlineChange={(id, online) => dispatch({ type: 'SET_CHANNEL_ONLINE', id, online })}
              onRemove={(id) => dispatch({ type: 'REMOVE_CHANNEL', id })}
              onSetActiveAudio={(id) => dispatch({ type: 'SET_ACTIVE_AUDIO_CHANNEL', id })}
              onVolumeChange={(id, volume) => dispatch({ type: 'SET_VOLUME', id, volume })}
              onFollow={handleFollow}
            />
          )}
        </main>

        {state.channels.length > 0 && (
          <ChatBar
            channels={state.channels}
            activeChatChannelId={state.activeChatChannelId}
            activeAudioChannelId={state.activeAudioChannelId}
            open={state.chatBarOpen}
            onSelectChat={(id) => dispatch({ type: 'SET_ACTIVE_CHAT_CHANNEL', id })}
            onToggle={() => dispatch({ type: 'TOGGLE_CHAT_BAR' })}
          />
        )}
      </div>

      {loginPrompt && (
        <div className="modal-backdrop" onClick={() => setLoginPrompt(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p>{loginPrompt}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setLoginPrompt(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-twitch" onClick={login}>
                <IconTwitch />
                <span>Log in with Twitch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
