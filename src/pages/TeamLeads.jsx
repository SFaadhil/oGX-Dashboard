import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiSearch, FiX, FiInbox, FiEye, FiRefreshCw, FiArrowLeft, FiUsers
} from 'react-icons/fi';
import { fetchLeads, fetchManagers } from '../lib/leadsApi';
import { fullName, formatDate, initials, percent } from '../lib/helpers';
import { STATUS_TONE, PRODUCTS, LEAD_STATUSES } from '../constants';

/**
 * `scope="all"` renders every team leader's leads grouped by manager.
 * `scope="member"` renders one manager's leads (route param `memberId`).
 */
export default function TeamLeads({ scope = 'all' }) {
  const { memberId } = useParams();

  const [leads, setLeads] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [status, setStatus] = useState('');
  const [managerFilter, setManagerFilter] = useState('');


  const load = useCallback(async () => {
    setLoading(true);
    const { rows } = await fetchLeads({
      filter: (q) => (scope === 'member' && memberId ? q.eq('manager_id', memberId) : q),
      withBackgrounds: false
    });
    setLeads(rows);
    const { rows: mgrs } = await fetchManagers('id, first_name, last_name, email, key_area, ogt');
    setManagers(mgrs);
    setLoading(false);
  }, [scope, memberId]);

  useEffect(() => { load(); }, [load]);

  const member = useMemo(
    () => managers.find((m) => m.id === memberId),
    [managers, memberId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (product && l.product !== product) return false;
      if (status && (l.status || 'Not Contacted') !== status) return false;
      if (managerFilter && l.manager_id !== managerFilter) return false;
      if (q) {
        const hay = [fullName(l), l.email, l.university, l.lead_id].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, product, status, managerFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const contacted = filtered.filter((l) => l.status && l.status !== 'Not Contacted').length;
    const applied = filtered.filter((l) => ['Applied', 'Approved'].includes(l.status)).length;
    return { total, contacted, applied, rate: percent(applied, total) };
  }, [filtered]);

  const title = scope === 'member'
    ? `${member ? [member.first_name, member.last_name].filter(Boolean).join(' ') : 'Team member'} - Leads`
    : 'All Team Leads';

  return (
    <>
      <div className="page-head">
        <div className="lead-hero">
          {scope === 'member' && (
            <Link className="row-btn" to="/dashboard/team"><FiArrowLeft /></Link>
          )}
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">
              {scope === 'member'
                ? member?.key_area || 'oGX team member'
                : `Leads owned across ${managers.length} team member(s).`}
            </p>
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
        </div>
      </div>

      <div className="tile-grid">
        <div className="tile accent">
          <div className="tile-icon"><FiUsers /></div>
          <span className="tile-value">{stats.total}</span>
          <span className="tile-label">Total Leads</span>
        </div>
        <div className="tile">
          <span className="tile-value">{stats.contacted}</span>
          <span className="tile-label">Contacted</span>
        </div>
        <div className="tile">
          <span className="tile-value">{stats.applied}</span>
          <span className="tile-label">Applied</span>
        </div>
        <div className="tile gold">
          <span className="tile-value">{stats.rate}%</span>
          <span className="tile-label">Conversion Rate</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, email, or university"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><FiX /></button>}
        </div>
        <select value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">All products</option>
          {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {scope === 'all' && (
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
            <option value="">All Team Members</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading team leads...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiInbox /><h3>No leads found</h3><p>Try adjusting your filters to see more results</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>Product</th><th>Status</th>
                  {scope === 'all' && <th>Manager</th>}
                  <th>University</th><th>Destination</th><th>Applied</th><th style={{ width: 60 }}>View</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="lead-name-cell">
                        <span className="mini-avatar">{initials(fullName(l))}</span>
                        <span><strong>{fullName(l)}</strong><span>{l.email || ''}</span></span>
                      </div>
                    </td>
                    <td>
                      {l.product
                        ? <span className={`product-badge product-${l.product}`}>{l.product}</span>
                        : '-'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_TONE[l.status] || 'badge-neutral'}`}>
                        {l.status || 'Not Contacted'}
                      </span>
                    </td>
                    {scope === 'all' && (
                      <td>
                        {l.manager
                          ? [l.manager.first_name, l.manager.last_name].filter(Boolean).join(' ')
                          : 'Unassigned'}
                      </td>
                    )}
                    <td>{l.university || '-'}</td>
                    <td>
<span className="badge badge-neutral">{l.host_mc || '-'}</span>
                    </td>
                    <td>{formatDate(l.created_at) || '-'}</td>
                    <td>
                      <Link className="row-btn" to={`/lead/${l.id}`}><FiEye /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
