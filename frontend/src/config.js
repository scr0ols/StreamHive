// In production the frontend is served behind a proxy (see vercel.json) that
// forwards /api/* and /auth/* to the backend, so an empty base URL keeps every
// request same-origin. That matters for auth: the session cookie is set on the
// frontend's own origin instead of the backend's, so browsers no longer treat
// it as a third-party cookie and drop it.
//
// Local dev has no proxy, so it falls back to the local backend. VITE_BACKEND_URL
// can still pin an explicit backend (Vite only exposes VITE_-prefixed env vars to
// client code); leave it unset in Vercel so the proxy is used.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')
