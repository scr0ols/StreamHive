import { useEffect, useState } from 'react'

const BACKEND_URL = 'http://localhost:3000'

function App() {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .finally(() => setChecked(true))
  }, [])

  function login() {
    window.location.href = `${BACKEND_URL}/auth/twitch/login`
  }

  function logout() {
    fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).then(() => setUser(null))
  }

  if (!checked) return <p>Checking session...</p>

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>StreamHive — OAuth spike</h1>
      {user ? (
        <div>
          <img src={user.avatarUrl} alt="" width={64} height={64} style={{ borderRadius: '50%' }} />
          <p>Logged in as <strong>{user.displayName}</strong> ({user.login})</p>
          <button onClick={logout}>Log out</button>
        </div>
      ) : (
        <button onClick={login}>Log in with Twitch</button>
      )}
    </div>
  )
}

export default App
