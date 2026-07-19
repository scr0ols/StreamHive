import { useState } from 'react'
import { MAX_CHANNELS } from '../gridReducer'
import { IconChevronDown, IconHeart, IconPlus } from './icons'

const BACKEND_URL = 'http://localhost:3000'

function formatViewers(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}

// Live channels the logged-in user follows on Twitch, with one-click
// add-to-grid. Fetched fresh on every open, kept in memory only (the
// backend never persists Twitch data either).
export default function FollowedLive({ channels, onAdd, onSessionExpired }) {
  const [open, setOpen] = useState(false)
  const [streams, setStreams] = useState(null) // null = loading
  const [error, setError] = useState(null)

  const inGrid = new Set(channels.map((c) => c.loginName))
  const atCap = channels.length >= MAX_CHANNELS

  async function fetchStreams() {
    setStreams(null)
    setError(null)
    const res = await fetch(`${BACKEND_URL}/api/followed-streams`, { credentials: 'include' }).catch(() => null)
    if (res?.status === 401) {
      setOpen(false)
      onSessionExpired()
      return
    }
    if (res?.status === 429) {
      setError('Twitch is rate limiting us, try again shortly.')
      return
    }
    if (!res?.ok) {
      setError("Couldn't load your followed channels.")
      return
    }
    const { streams: data } = await res.json()
    setStreams(data)
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) fetchStreams()
  }

  return (
    <div className="dropdown">
      <button type="button" className="btn btn-ghost" onClick={toggleOpen} aria-expanded={open}>
        <IconHeart />
        <span>Following</span>
        <IconChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-panel">
            {error && <p className="template-status err">{error}</p>}
            {!error && streams === null && <p className="template-status">Loading…</p>}
            {streams?.length === 0 && (
              <p className="template-status">None of the channels you follow are live right now.</p>
            )}
            {streams?.map((s) => (
              <div key={s.loginName} className="followed-row">
                <div className="followed-row-info">
                  <span className="followed-row-name">
                    <span className="live-dot" />
                    {s.displayName}
                  </span>
                  <span className="followed-row-meta" title={s.title}>
                    {s.gameName || 'Streaming'} · {formatViewers(s.viewerCount)} viewers
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={inGrid.has(s.loginName) || atCap}
                  onClick={() => onAdd(s.loginName)}
                  title={
                    inGrid.has(s.loginName)
                      ? 'Already in the grid'
                      : atCap
                        ? '5-channel max reached'
                        : `Add ${s.displayName} to the grid`
                  }
                >
                  <IconPlus size={13} />
                  <span>{inGrid.has(s.loginName) ? 'Added' : 'Add'}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
