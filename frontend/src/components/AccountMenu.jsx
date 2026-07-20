import { useState } from 'react'
import { IconChevronDown } from './icons'

// Rightmost item in the top bar, so the dropdown panel keeps the default
// right:0 anchor (its right edge already sits near the viewport edge).
export default function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)

  function handleLogout() {
    setOpen(false)
    onLogout()
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
            <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
