import { useState } from 'react'
import {
  getDefaultAudioMode,
  setDefaultAudioMode,
  getDefaultChatBarOpen,
  setDefaultChatBarOpen,
  getTheme,
  setTheme,
} from '../settings'

// Default audio mode / chat-bar-open only take effect on the next session
// (they seed the reducer's initial state); theme applies immediately since
// it just flips a DOM attribute. Stored in localStorage, client-only, no
// backend involved.
export default function SettingsModal({ onClose }) {
  const [audioMode, setAudioModeState] = useState(getDefaultAudioMode())
  const [chatBarOpen, setChatBarOpenState] = useState(getDefaultChatBarOpen())
  const [theme, setThemeState] = useState(getTheme())

  function handleAudioMode(mode) {
    setAudioModeState(mode)
    setDefaultAudioMode(mode)
  }

  function handleChatBarOpen(open) {
    setChatBarOpenState(open)
    setDefaultChatBarOpen(open)
  }

  function handleTheme(value) {
    setThemeState(value)
    setTheme(value)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="settings-row">
          <div>
            <span className="settings-label">Default audio mode</span>
            <span className="settings-hint">Applies to new sessions</span>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={audioMode === 'selection' ? 'active' : ''}
              onClick={() => handleAudioMode('selection')}
            >
              Selection
            </button>
            <button
              type="button"
              className={audioMode === 'both' ? 'active' : ''}
              onClick={() => handleAudioMode('both')}
            >
              Both/All
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <span className="settings-label">Chat bar starts open</span>
            <span className="settings-hint">Applies to new sessions</span>
          </div>
          <div className="segmented">
            <button type="button" className={chatBarOpen ? 'active' : ''} onClick={() => handleChatBarOpen(true)}>
              On
            </button>
            <button type="button" className={!chatBarOpen ? 'active' : ''} onClick={() => handleChatBarOpen(false)}>
              Off
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">Theme</span>
          <div className="segmented">
            <button type="button" className={theme === 'system' ? 'active' : ''} onClick={() => handleTheme('system')}>
              System
            </button>
            <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => handleTheme('light')}>
              Light
            </button>
            <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => handleTheme('dark')}>
              Dark
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
