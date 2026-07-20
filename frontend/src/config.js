// Set VITE_BACKEND_URL at build time for non-local deployments (Vite only
// exposes env vars prefixed with VITE_ to client code). Falls back to the
// local backend so `npm run dev` keeps working with no .env file.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
