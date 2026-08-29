import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiUserCheck, FiTrendingUp, FiPieChart, FiClock, FiArrowRight,
  FiAlertCircle, FiGlobe, FiTag, FiRefreshCw
} from 'react-icons/fi';
import { fetchLeads } from '../lib/leadsApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { countBy, percent, sortedEntries, fullName, formatDate, formatDateTime, initials } from '../lib/helpers';
import { PRODUCT_COLORS, STATUS_TONE } from '../constants';

export default function DashboardHome() {
  const [leads, setLeads] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { rows, error: err } = await fetchLeads({ withDocuments: false });
      if (cancelled) return;
      if (err) setError(err);
      setLeads(rows);

      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('sync_runs')
          .select('finished_at, fetched, inserted, status')
          .eq('status', 'success')
          .order('finished_at', { ascending: false })
          .limit(1);
        if (!cancelled) setLastSync(data?.[0] || null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const total = leads.length;
    const products = countBy(leads, (l) => (l.product === 'GTa' || l.product === 'GTe' ? l.product : null));
    const statuses = countBy(leads, (l) => l.status || 'Not Contacted');
    const universities = sortedEntries(countBy(leads, (l) => l.university)).slice(0, 5);
    const hostMcs = sortedEntries(countBy(leads, (l) => l.host_mc)).slice(0, 5);
    const backgrounds = sortedEntries(countBy(leads, (l) => (l.backgrounds || []).map((b) => b.name))).slice(0, 5);
    const inPool = leads.filter((l) => l.show_in_cvpool).length;
    const managed = leads.filter((l) => l.manager_id).length;
    // Documents are not fetched here (too heavy for an overview), so anything
    // CV-related belongs on the Leads page, not on this tile row.
    const universityCount = new Set(leads.map((l) => l.university).filter(Boolean)).size;
    return {
      total, products, statuses, universities, hostMcs, backgrounds,
      inPool, managed, universityCount
    };
  }, [leads]);

  const recent = useMemo(
    () => [...leads]
      .sort((a, b) => new Date(b.applied_at || b.created_at || 0) - new Date(a.applied_at || a.created_at || 0))
      .slice(0, 8),
    [leads]
  );

  const maxUni = stats.universities.length ? stats.universities[0][1] : 1;
  const maxMc = stats.hostMcs.length ? stats.hostMcs[0][1] : 1;

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading the pipeline...</p></div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">oGX Pipeline Overview</h1>
          <p className="page-subtitle">
            Every GTa and GTe application from AIESEC in India, synced from EXPA.
            {lastSync?.finished_at && ` Last updated ${formatDateTime(lastSync.finished_at)}.`}
          </p>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn-ghost" to="/dashboard/sync"><FiRefreshCw /> Sync status</Link>
          <Link className="btn btn-primary" to="/dashboard/leads">Browse leads <FiArrowRight /></Link>
        </div>
      </div>

      {error && (
        <div className="empty-state">
          <FiAlertCircle /><h3>Could not load leads</h3><p>{error}</p>
        </div>
      )}

      <div className="tile-grid">
        <div className="tile accent">
          <div className="tile-icon"><FiUsers /></div>
          <span className="tile-value">{stats.total}</span>
          <span className="tile-label">Total Applications</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiPieChart /></div>
          <span className="tile-value">{stats.products.GTa || 0}</span>
          <span className="tile-label">GTa</span>
          <span className="tile-sub">{percent(stats.products.GTa || 0, stats.total)}% of pipeline</span>
        </div>
        <div className="tile gold">
          <div className="tile-icon"><FiPieChart /></div>
          <span className="tile-value">{stats.products.GTe || 0}</span>
          <span className="tile-label">GTe</span>
          <span className="tile-sub">{percent(stats.products.GTe || 0, stats.total)}% of pipeline</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiUserCheck /></div>
          <span className="tile-value">{stats.managed}</span>
          <span className="tile-label">With an EP Manager</span>
          <span className="tile-sub">{stats.total - stats.managed} unassigned</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiTag /></div>
          <span className="tile-value">{stats.universityCount}</span>
          <span className="tile-label">Universities</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiTrendingUp /></div>
          <span className="tile-value">{stats.inPool}</span>
          <span className="tile-label">Live in CV Pool</span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3><FiClock /> Latest Applications</h3>
            <Link className="link-btn" to="/dashboard/leads">View all</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Product</th><th>Applying to</th><th>University</th><th>Applied</th></tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link className="lead-name-cell" to={`/lead/${l.id}`}>
                        <span className="mini-avatar">{initials(fullName(l))}</span>
                        <span>
                          <strong>{fullName(l)}</strong>
                          <span>{l.lead_id ? `EP ${l.lead_id}` : ''}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {l.product
                        ? <span className={`product-badge product-${l.product}`}>{l.product}</span>
                        : '-'}
                    </td>
                    <td>{l.host_mc || '-'}</td>
                    <td>{l.university || '-'}</td>
                    <td>{formatDate(l.applied_at || l.created_at) || '-'}</td>
                  </tr>
                ))}
                {!recent.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                      No leads yet. The EXPA sync populates this table.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiPieChart /> Product Split</h3></div>
            <div className="panel-body rank-list">
              {['GTa', 'GTe'].map((p) => (
                <div className="rank-row" key={p}>
                  <div className="rank-row-head">
                    <strong>{p}</strong>
                    <span>{stats.products[p] || 0} ({percent(stats.products[p] || 0, stats.total)}%)</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${percent(stats.products[p] || 0, stats.total)}%`,
                        background: PRODUCT_COLORS[p]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiGlobe /> Top Destinations</h3></div>
            <div className="panel-body rank-list">
              {stats.hostMcs.map(([mc, count]) => (
                <div className="rank-row" key={mc}>
                  <div className="rank-row-head"><strong>{mc}</strong><span>{count}</span></div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(count / maxMc) * 100}%` }} />
                  </div>
                </div>
              ))}
              {!stats.hostMcs.length && <p className="tile-sub">No destination data yet.</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiUsers /> Top Universities</h3></div>
            <div className="panel-body rank-list">
              {stats.universities.map(([uni, count]) => (
                <div className="rank-row" key={uni}>
                  <div className="rank-row-head">
                    <strong title={uni}>{uni.length > 34 ? `${uni.slice(0, 34)}...` : uni}</strong>
                    <span>{count}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(count / maxUni) * 100}%` }} />
                  </div>
                </div>
              ))}
              {!stats.universities.length && <p className="tile-sub">No university data yet.</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiTrendingUp /> Status Breakdown</h3></div>
            <div className="panel-body chip-row">
              {sortedEntries(stats.statuses).map(([status, count]) => (
                <span className={`badge ${STATUS_TONE[status] || 'badge-neutral'}`} key={status}>
                  {status} {count}
                </span>
              ))}
              {!Object.keys(stats.statuses).length && <p className="tile-sub">No status data yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
