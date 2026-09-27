import { Navigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context'

export function PublicOnly({ children }) {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="auth-loading">Loading…</div>
  if (!configured) return children
  if (user) return <Navigate to="/" replace />
  return children
}

export function RequireAuth({ children }) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()
  if (loading) return <div className="auth-loading">Loading…</div>
  if (!configured) return children
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export function AuthFooter({ mode }) {
  return (
    <div className="auth-footer">
      {mode === 'login' ? <span>New Here? <Link to="/signup">Create an Account</Link></span> : <span>Already Have an Account? <Link to="/login">Log In</Link></span>}
    </div>
  )
}
