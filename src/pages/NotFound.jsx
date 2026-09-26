import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'

export default function NotFound() {
  const navigate = useNavigate()
  return <div className="page-container"><div className="empty-state"><div className="eyebrow">404</div><h1>Page not found.</h1><p>The route does not exist.</p><button className="button button-secondary" onClick={() => navigate('/')}><Icon name="home" size={16} />Return home</button></div></div>
}
