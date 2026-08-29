import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiUserCheck, FiTrendingUp, FiPieChart, FiClock, FiArrowRight,
  FiCheckSquare, FiAlertCircle
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { fetchLeads } from '../lib/leadsApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { countBy, percent, sortedEntries, fullName, formatDate, initials } from '../lib/helpers';
import { PRODUCT_COLORS, STATUS_TONE } from '../constants';

export default function DashboardHome() {
  const { manager, isVP } = useAuth();
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { rows, error: err } = await fetchLeads({
        filter: (q) => (isVP ? q : q.eq('manager_id', manager?.id)),
        withDocuments: false
      });
      if (cancelled) return;
      if (err) setError(err);
      setLeads(rows);

      if (isSupabaseConfigured && manager?.id) {
        const { data } = await supabase
          .from('followups')
          .select('id, application_id, notes, priority, done, created_at')
          .eq('manager_id', manager.id)
          .eq('done', false)
          .order('created_at', { ascending: false })
          .limit(5);
        if (!cancelled) setFollowups(data || []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [manager?.id, isVP]);

  const stats = useMemo(() => {
    const total = leads.length;
    const contacted = leads.filter((l) => l.status && l.status !== 'Not Contacted').length;
    const applied = leads.filter((l) => ['Applied', 'Approved'].includes(l.status)).length;
    const approved = leads.filter((l) => l.status === 'Approved').length;
    const onExpa = leads.filter((l) => l.assigned_on_expa).length;
    const inPool = leads.filter((l) => l.show_in_cvpool).length;
    const products = countBy(leads, (l) => (l.product === 'GTa' || l.product === 'GTe' ? l.product : null));
    const statuses = countBy(leads, (l) => l.status || 'Not Contacted');
    const universities = sortedEntries(countBy(leads, (l) => l.university)).slice(0, 5);
    return { total, contacted, applied, approved, onExpa, inPool, products, statuses, universities };
  }, [leads]);

  const recent = useMemo(() => leads.slice(0, 6), [leads]);
  const maxUni = stats.universities.length ? stats.universities[0][1] : 1;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading your workspace...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Welcome back{manager?.first_name ? `, ${manager.first_name}` : ''}
          </h1>
          <p className="page-subtitle">
            {isVP
              ? 'Organisation-wide view of every oGX lead in the entity.'
              : 'Everything assigned to you across GTa and GTe.'}
          </p>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn-ghost" to="/dashboard/leads">My Leads <FiArrowRight /></Link>
          <Link className="btn btn-primary" to="/dashboard/team-performance">
            <FiTrendingUp /> Team Performance
          </Link>
        </div>
      </div>

      {error && (
        <div className="empty-state">
          <FiAlertCircle />
          <h3>Could not load leads</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="tile-grid">
        <div className="tile accent">
          <div className="tile-icon"><FiUsers /></div>
          <span className="tile-value">{stats.total}</span>
          <span className="tile-label">Total Leads</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiUserCheck /></div>
          <span className="tile-value">{stats.contacted}</span>
          <span className="tile-label">Contacted</span>
          <span className="tile-sub">{percent(stats.contacted, stats.total)}% of pipeline</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiTrendingUp /></div>
          <span className="tile-value">{stats.applied}</span>
          <span className="tile-label">Applied</span>
          <span className="tile-sub">{stats.approved} approved</span>
        </div>
        <div className="tile gold">
          <div className="tile-icon"><FiPieChart /></div>
          <span className="tile-value">{percent(stats.applied, stats.total)}%</span>
          <span className="tile-label">Conversion Rate</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiCheckSquare /></div>
          <span className="tile-value">{stats.onExpa}</span>
          <span className="tile-label">Assigned on EXPA</span>
          <span className="tile-sub">{stats.total - stats.onExpa} pending</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiUsers /></div>
          <span className="tile-value">{stats.inPool}</span>
          <span className="tile-label">Live in CV Pool</span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3><FiClock /> Recent Leads</h3>
            <Link className="link-btn" to="/dashboard/leads">View all</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>Product</th><th>Status</th><th>University</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link className="lead-name-cell" to={`/lead/${l.id}`}>
                        <span className="mini-avatar">{initials(fullName(l))}</span>
                        <span>
                          <strong>{fullName(l)}</strong>
                          <span>{l.email || l.lead_id || ''}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {l.product ? (
                        <span
                          className="badge"
                          style={{
                            background: `${PRODUCT_COLORS[l.product] || '#8a8a8a'}22`,
                            color: l.product === 'GTe' ? 'var(--warning)' : 'var(--primary)'
                          }}
                        >
                          {l.product}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_TONE[l.status] || 'badge-neutral'}`}>
                        {l.status || 'Not Contacted'}
                      </span>
                    </td>
                    <td>{l.university || '-'}</td>
                    <td>{formatDate(l.created_at) || '-'}</td>
                  </tr>
                ))}
                {!recent.length && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>No leads found</td></tr>
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
                      className={`progress-fill${p === 'GTe' ? ' gold' : ''}`}
                      style={{ width: `${percent(stats.products[p] || 0, stats.total)}%` }}
                    />
                  </div>
                </div>
              ))}
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
            <div className="panel-head">
              <h3><FiCheckSquare /> Open Follow-ups</h3>
              <Link className="link-btn" to="/dashboard/followups">Open</Link>
            </div>
            <div className="panel-body note-list">
              {followups.map((f) => (
                <div className="note" key={f.id}>
                  <p>{f.notes || 'No note'}</p>
                  <small>{f.priority || 'Default'} - EP {f.application_id}</small>
                </div>
              ))}
              {!followups.length && <p className="tile-sub">No follow-up records found.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
