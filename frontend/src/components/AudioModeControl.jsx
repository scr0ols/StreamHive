export default function AudioModeControl({ audioMode, onSetAudioMode }) {
  return (
    <div className="audio-mode-control" role="group" aria-label="Audio mode">
      <span className="audio-mode-label">Audio</span>
      <div className="segmented">
        <button
          type="button"
          className={audioMode === 'selection' ? 'active' : ''}
          onClick={() => onSetAudioMode('selection')}
          title="One channel audible; its panel gets the focus layout"
        >
          Selection
        </button>
        <button
          type="button"
          className={audioMode === 'both' ? 'active' : ''}
          onClick={() => onSetAudioMode('both')}
          title="All channels audible, each with its own volume"
        >
          Both/All
        </button>
      </div>
    </div>
  )
}
