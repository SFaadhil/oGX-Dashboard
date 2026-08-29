import { Link } from 'react-router-dom';
import { FiCompass } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="cv-pool-closed">
      <div className="closed-card">
        <FiCompass />
        <h2>Page not found</h2>
        <p>The page you were looking for does not exist.</p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1.25rem' }}>
          <Link className="btn btn-ghost" to="/cv-pool">CV Pool</Link>
          <Link className="btn btn-primary" to="/dashboard">Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
