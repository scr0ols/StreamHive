import { useEffect, useRef } from 'react'
import { loadTwitchEmbedScript } from '../twitchEmbed'
import { IconExternalLink, IconGift, IconHeart, IconVolumeOff, IconVolumeOn, IconX } from './icons'

// Online/offline status comes from channel.online (populated by a Helix
// /streams poll in App.jsx), not from the embed's own ONLINE/OFFLINE
// events, those are documented but unreliable, see c-docs/NOTES.md.
export default function VideoPanel({
  channel,
  muted,
  volume,
  focused,
  gridStyle,
  audioMode,
  isActiveAudio,
  onOnlineChange,
  onRemove,
  onSetActiveAudio,
  onVolumeChange,
  onFollow,
}) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    playerRef.current = null

    loadTwitchEmbedScript().then(() => {
      if (cancelled || !containerRef.current) return

      const embed = new window.Twitch.Embed(containerRef.current, {
        width: '100%',
        height: '100%',
        channel: channel.loginName,
        layout: 'video',
        parent: [window.location.hostname],
        muted: true,
      })

      embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
        if (cancelled) return
        const player = embed.getPlayer()
        playerRef.current = player
        player.addEventListener(window.Twitch.Player.ONLINE, () => {
          if (cancelled) return
          onOnlineChange(channel.id, true)
        })
        player.addEventListener(window.Twitch.Player.OFFLINE, () => {
          if (cancelled) return
          onOnlineChange(channel.id, false)
        })
      })
    })

    return () => {
      cancelled = true
      playerRef.current = null
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, channel.loginName])

  useEffect(() => {
    playerRef.current?.setMuted(muted)
  }, [muted])

  useEffect(() => {
    playerRef.current?.setVolume(volume / 100)
  }, [volume])

  return (
    <div className={`video-panel${focused ? ' focused' : ''}`} style={gridStyle}>
      <div className="video-panel-embed" ref={containerRef} />
      {channel.online === false && (
        <div className="video-panel-overlay">
          <span className="video-panel-overlay-name">{channel.loginName}</span>
          <span>is offline</span>
        </div>
      )}
      <div className="video-panel-bar">
        {channel.online && <span className="live-dot" title="Live" />}
        <span className="video-panel-name">{channel.loginName}</span>

        {audioMode === 'selection' ? (
          <button
            type="button"
            className={`panel-btn listen-btn${isActiveAudio ? ' listening' : ''}`}
            disabled={isActiveAudio}
            onClick={() => onSetActiveAudio(channel.id)}
            title={isActiveAudio ? 'Currently audible' : `Listen to ${channel.loginName}`}
          >
            {isActiveAudio ? <IconVolumeOn /> : <IconVolumeOff />}
            <span>{isActiveAudio ? 'Listening' : 'Listen'}</span>
          </button>
        ) : (
          <input
            className="video-panel-volume"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange(channel.id, Number(e.target.value))}
            title={`${channel.loginName} volume`}
            aria-label={`${channel.loginName} volume`}
          />
        )}

        <div className="video-panel-actions">
          <button
            type="button"
            className="panel-btn icon-only"
            onClick={() => onFollow(channel)}
            title={`Follow ${channel.loginName} on Twitch`}
            aria-label={`Follow ${channel.loginName} on Twitch`}
          >
            <IconHeart />
          </button>
          <a
            className="panel-btn icon-only"
            href={`https://www.twitch.tv/${channel.loginName}/about`}
            target="_blank"
            rel="noreferrer"
            title={`Donate / support ${channel.loginName} (their About page)`}
            aria-label={`Donate to ${channel.loginName}`}
          >
            <IconGift />
          </a>
          <a
            className="panel-btn icon-only"
            href={`https://twitch.tv/${channel.loginName}`}
            target="_blank"
            rel="noreferrer"
            title={`Open ${channel.loginName}'s channel`}
            aria-label={`Open ${channel.loginName}'s channel`}
          >
            <IconExternalLink />
          </a>
          <button
            type="button"
            className="panel-btn icon-only remove-btn"
            onClick={() => onRemove(channel.id)}
            title={`Remove ${channel.loginName} from the grid`}
            aria-label={`Remove ${channel.loginName} from the grid`}
          >
            <IconX />
          </button>
        </div>
      </div>
    </div>
  )
}
