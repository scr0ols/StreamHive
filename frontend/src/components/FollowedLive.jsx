import { useState } from 'react'
import { MAX_CHANNELS } from '../gridReducer'
import { IconChevronDown, IconHeart, IconPlus } from './icons'

const BACKEND_URL = 'http://localhost:3000'

function formatViewers(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}

// Live followed channels plus Twitch's top viewer-count streams. Both lists
// are fetched fresh on open and remain in memory only.
export default function FollowedLive({ channels, onAdd, onSessionExpired }) {
  const [open, setOpen] = useState(false)
  const [followedStreams, setFollowedStreams] = useState(null)
  const [trendingStreams, setTrendingStreams] = useState(null)
  const [error, setError] = useState(null)

  const inGrid = new Set(channels.map((channel) => channel.loginName))
  const atCap = channels.length >= MAX_CHANNELS

  async function fetchStreams() {
    setFollowedStreams(null)
    setTrendingStreams(null)
    setError(null)

    const [followedRes, trendingRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/followed-streams`, { credentials: 'include' }).catch(() => null),
      fetch(`${BACKEND_URL}/api/trending-streams`).catch(() => null),
    ])

    if (followedRes?.status === 401) {
      setOpen(false)
      onSessionExpired()
      return
    }
    if (followedRes?.status === 429 || trendingRes?.status === 429) {
      setError('Twitch is rate limiting us, try again shortly.')
      return
    }
    if (!followedRes?.ok || !trendingRes?.ok) {
      setError("Couldn't load Online now.")
      return
    }

    const [{ streams: followed }, { streams: trending }] = await Promise.all([followedRes.json(), trendingRes.json()])
    const followedLogins = new Set(followed.map((stream) => stream.loginName))
    setFollowedStreams(followed)
    setTrendingStreams(trending.filter((stream) => !followedLogins.has(stream.loginName)))
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
        <span>Online now</span>
        <IconChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-panel online-now-panel">
            {error && <p className="template-status err">{error}</p>}
            {!error && followedStreams === null && <p className="template-status">Loading…</p>}
            {followedStreams && (
              <section className="online-section" aria-label="Following live">
                <h2>Following live</h2>
                {followedStreams.length === 0 && <p className="template-status">Nobody you follow is live right now.</p>}
                {followedStreams.map((stream) => (
                  <StreamRow key={stream.loginName} stream={stream} inGrid={inGrid} atCap={atCap} onAdd={onAdd} />
                ))}
              </section>
            )}
            {trendingStreams && (
              <section className="online-section" aria-label="Trending live">
                <h2>Trending live</h2>
                {trendingStreams.map((stream) => (
                  <StreamRow key={stream.loginName} stream={stream} inGrid={inGrid} atCap={atCap} onAdd={onAdd} />
                ))}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StreamRow({ stream, inGrid, atCap, onAdd }) {
  const added = inGrid.has(stream.loginName)
  return (
    <div className="followed-row">
      <div className="followed-row-info">
        <span className="followed-row-name">
          <span className="live-dot" />
          {stream.displayName}
        </span>
        <span className="followed-row-meta" title={stream.title}>
          {stream.gameName || 'Streaming'} · {formatViewers(stream.viewerCount)} viewers
        </span>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        disabled={added || atCap}
        onClick={() => onAdd(stream.loginName)}
        title={added ? 'Already in the grid' : atCap ? '5-channel max reached' : `Add ${stream.displayName} to the grid`}
      >
        <IconPlus size={13} />
        <span>{added ? 'Added' : 'Add'}</span>
      </button>
    </div>
  )
}
