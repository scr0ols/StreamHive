import VideoPanel from './VideoPanel'

export default function VideoGrid({
  channels,
  audioMode,
  activeAudioChannelId,
  volumes,
  onOnlineChange,
  onRemove,
  onSetActiveAudio,
  onVolumeChange,
  onFollow,
}) {
  const focusMode = audioMode === 'selection'
  const otherChannels = focusMode ? channels.filter((c) => c.id !== activeAudioChannelId) : []

  function panelGridStyle(channel) {
    if (!focusMode) return undefined
    if (channel.id === activeAudioChannelId) {
      return { gridColumn: 1, gridRow: `1 / span ${Math.max(otherChannels.length, 1)}` }
    }
    const idx = otherChannels.findIndex((c) => c.id === channel.id)
    return { gridColumn: 2, gridRow: idx + 1 }
  }

  return (
    <div
      className={`video-grid ${focusMode ? 'video-grid-focus' : `video-grid-symmetric count-${channels.length}`}`}
    >
      {channels.map((channel) => (
        <VideoPanel
          key={channel.id}
          gridStyle={panelGridStyle(channel)}
          channel={channel}
          focused={focusMode && channel.id === activeAudioChannelId}
          muted={focusMode ? channel.id !== activeAudioChannelId : false}
          volume={focusMode ? 100 : (volumes[channel.id] ?? 50)}
          audioMode={audioMode}
          isActiveAudio={channel.id === activeAudioChannelId}
          onOnlineChange={onOnlineChange}
          onRemove={onRemove}
          onSetActiveAudio={onSetActiveAudio}
          onVolumeChange={onVolumeChange}
          onFollow={onFollow}
        />
      ))}
    </div>
  )
}
