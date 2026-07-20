import { useState } from 'react'
import { IconChevronDown, IconExternalLink, IconLogout, IconSettings, IconTwitch } from './icons'

// Rightmost item in the top bar, so the dropdown panel keeps the default
// right:0 anchor (its right edge already sits near the viewport edge).
export default function AccountMenu({ user, onLogout, onOpenSettings }) {
  const [open, setOpen] = useState(false)

  function handleLogout() {
    setOpen(false)
    onLogout()
  }

  function handleSettings() {
    setOpen(false)
    onOpenSettings()
  }

  return (
    <div className="dropdown">
      <button
        type="button"
        className="btn btn-ghost account-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <img className="auth-avatar" src={user.avatarUrl} alt="" width={24} height={24} />
        <span className="auth-name">{user.displayName}</span>
        <IconChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-panel account-panel">
            <a
              className="menu-item"
              href={`https://www.twitch.tv/${user.login}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <IconTwitch />
              <span>Twitch account</span>
              <IconExternalLink size={13} className="menu-item-external" />
            </a>
            <button type="button" className="menu-item" onClick={handleSettings}>
              <IconSettings />
              <span>Settings</span>
            </button>
            <div className="menu-divider" />
            <button type="button" className="menu-item menu-item-danger" onClick={handleLogout}>
              <IconLogout />
              <span>Log out</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
