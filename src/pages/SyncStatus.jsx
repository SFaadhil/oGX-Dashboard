import { useCallback, useEffect, useState } from 'react';
import { FiDownloadCloud, FiClock, FiActivity, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { formatDateTime } from '../lib/helpers';

/** Read-only health of the hourly EXPA pull. */
export default function SyncStatus() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(48);
    if (err) setError(err.message);
    setRuns(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading sync history...</p></div>;
  }

  const last = runs[0];
  const lastSuccess = runs.find((r) => r.status === 'success');
  const ageMinutes = lastSuccess
    ? Math.round((Date.now() - new Date(lastSuccess.finished_at || lastSuccess.started_at).getTime()) / 60000)
    : null;
  const stale = ageMinutes === null || ageMinutes > 90;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">EXPA Sync</h1>
          <p className="page-subtitle">
            The hourly job that pulls AIESEC in India GTa and GTe applications into this dashboard.
          </p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
        </div>
      </div>

      {error && (
        <div className="empty-state"><FiAlertCircle /><h3>Could not load sync history</h3><p>{error}</p></div>
      )}

      <div className="tile-grid">
        <div className={`tile ${stale ? '' : 'accent'}`}>
          <div className="tile-icon"><FiClock /></div>
          <span className="tile-value">
            {ageMinutes === null ? 'Never' : ageMinutes < 60 ? `${ageMinutes}m` : `${Math.round(ageMinutes / 60)}h`}
          </span>
          <span className="tile-label">Since last successful sync</span>
          <span className="tile-sub">{stale ? 'Overdue - check the scheduled job' : 'Healthy'}</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiDownloadCloud /></div>
          <span className="tile-value">{last?.fetched ?? 0}</span>
          <span className="tile-label">Fetched last run</span>
          <span className="tile-sub">{last?.inserted ?? 0} new, {last?.updated ?? 0} refreshed</span>
        </div>
        <div className="tile gold">
          <div className="tile-icon"><FiActivity /></div>
          <span className="tile-value">
            {runs.filter((r) => r.status === 'success').length}/{runs.length}
          </span>
          <span className="tile-label">Recent runs succeeded</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3><FiDownloadCloud /> Run history</h3></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Started</th><th>Window</th><th>Fetched</th><th>New</th>
                <th>Updated</th><th>CVs</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.started_at)}</td>
                  <td>
                    {r.window_from
                      ? `${formatDateTime(r.window_from)} -> ${formatDateTime(r.window_to)}`
                      : 'all time'}
                  </td>
                  <td>{r.fetched}</td>
                  <td>{r.inserted}</td>
                  <td>{r.updated}</td>
                  <td>{r.cvs_linked}</td>
                  <td>
                    <span className={`badge ${r.status === 'success' ? 'badge-success' : r.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {r.status}
                    </span>
                    {r.error && <div className="tile-sub" title={r.error}>{r.error.slice(0, 60)}</div>}
                  </td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                    No sync has run yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
