export default function AudioModeControl({ audioMode, onSetAudioMode }) {
  return (
    <div className="segmented" role="group" aria-label="Audio mode">
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
  )
}
