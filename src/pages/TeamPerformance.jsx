import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTrendingUp, FiUsers, FiAward, FiTarget, FiRefreshCw, FiInbox, FiArrowRight
} from 'react-icons/fi';
import { fetchLeads, fetchManagers } from '../lib/leadsApi';
import { percent, initials, countBy } from '../lib/helpers';
import { DATE_RANGES, PRODUCT_COLORS } from '../constants';

export default function TeamPerformance() {
  const [leads, setLeads] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('all');
  const [sortKey, setSortKey] = useState('total');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { rows } = await fetchLeads({ withBackgrounds: false, withDocuments: false });
      const { rows: mgrs } = await fetchManagers('id, first_name, last_name, email, key_area, ogt');
      if (cancelled) return;
      setLeads(rows);
      setManagers(mgrs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const scoped = useMemo(() => {
    if (range === 'all') return leads;
    const cutoff = Date.now() - Number(range) * 86400000;
    return leads.filter((l) => new Date(l.created_at || 0).getTime() >= cutoff);
  }, [leads, range]);

  const rows = useMemo(() => {
    const byManager = {};
    scoped.forEach((l) => {
      if (!l.manager_id) return;
      const b = (byManager[l.manager_id] = byManager[l.manager_id] || {
        total: 0, contacted: 0, applied: 0, approved: 0, expa: 0, pool: 0
      });
      b.total += 1;
      if (l.status && l.status !== 'Not Contacted') b.contacted += 1;
      if (['Applied', 'Approved'].includes(l.status)) b.applied += 1;
      if (l.status === 'Approved') b.approved += 1;
      if (l.cv_url) b.expa += 1;
      if (l.show_in_cvpool) b.pool += 1;
    });

    return managers
      .map((m) => {
        const s = byManager[m.id] || { total: 0, contacted: 0, applied: 0, approved: 0, expa: 0, pool: 0 };
        return {
          ...m,
          ...s,
          name: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
          rate: percent(s.applied, s.total),
          contactRate: percent(s.contacted, s.total)
        };
      })
      .sort((a, b) => (sortKey === 'rate' ? b.rate - a.rate : b[sortKey] - a[sortKey]));
  }, [scoped, managers, sortKey]);

  const totals = useMemo(() => {
    const total = scoped.length;
    const contacted = scoped.filter((l) => l.status && l.status !== 'Not Contacted').length;
    const applied = scoped.filter((l) => ['Applied', 'Approved'].includes(l.status)).length;
    const products = countBy(scoped, (l) => (l.product === 'GTa' || l.product === 'GTe' ? l.product : null));
    return { total, contacted, applied, rate: percent(applied, total), products };
  }, [scoped]);

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading team performance...</p></div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Team Performance Dashboard</h1>
          <p className="page-subtitle">Track your team's progress and performance metrics.</p>
        </div>
        <div className="page-head-actions">
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="total">Sort by leads</option>
            <option value="applied">Sort by applications</option>
            <option value="rate">Sort by conversion</option>
          </select>
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      <div className="tile-grid">
        <div className="tile accent">
          <div className="tile-icon"><FiUsers /></div>
          <span className="tile-value">{totals.total}</span>
          <span className="tile-label">Total Leads</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiTarget /></div>
          <span className="tile-value">{totals.contacted}</span>
          <span className="tile-label">Contacted</span>
          <span className="tile-sub">{percent(totals.contacted, totals.total)}% reached</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiTrendingUp /></div>
          <span className="tile-value">{totals.applied}</span>
          <span className="tile-label">Applications</span>
        </div>
        <div className="tile gold">
          <div className="tile-icon"><FiAward /></div>
          <span className="tile-value">{totals.rate}%</span>
          <span className="tile-label">Team Rate</span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3><FiTrendingUp /> Manager Leaderboard</h3>
            <span className="tile-sub">{rows.length} member(s)</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty-state"><FiInbox /><h3>No assignments yet</h3></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Member</th><th>Leads</th><th>Contacted</th>
                    <th>Applied</th><th>Approved</th><th>With CV</th><th>Rate</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>
                        <div className="lead-name-cell">
                          <span className="mini-avatar">{initials(r.name)}</span>
                          <span><strong>{r.name}</strong><span>{r.key_area || 'Team Member'}</span></span>
                        </div>
                      </td>
                      <td>{r.total}</td>
                      <td>{r.contacted}</td>
                      <td>{r.applied}</td>
                      <td>{r.approved}</td>
                      <td>{r.expa}</td>
                      <td>
                        <span className={`badge ${r.rate >= 20 ? 'badge-success' : r.rate > 0 ? 'badge-warning' : 'badge-neutral'}`}>
                          {r.rate}%
                        </span>
                      </td>
                      <td>
                        <Link className="row-btn" to={`/dashboard/team-leads/${r.id}`}><FiArrowRight /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiUsers /> Lead Volume</h3></div>
            <div className="panel-body rank-list">
              {rows.slice(0, 8).map((r) => (
                <div className="rank-row" key={r.id}>
                  <div className="rank-row-head"><strong>{r.name}</strong><span>{r.total}</span></div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiTarget /> Product Split</h3></div>
            <div className="panel-body rank-list">
              {['GTa', 'GTe'].map((p) => (
                <div className="rank-row" key={p}>
                  <div className="rank-row-head">
                    <strong>{p}</strong>
                    <span>{totals.products[p] || 0} ({percent(totals.products[p] || 0, totals.total)}%)</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${percent(totals.products[p] || 0, totals.total)}%`,
                        background: PRODUCT_COLORS[p]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
