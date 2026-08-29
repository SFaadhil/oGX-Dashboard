import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiUserCheck, FiSearch, FiX, FiLock, FiRefreshCw, FiCheckSquare, FiSquare,
  FiInbox, FiUsers, FiZap
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fetchLeads, fetchManagers, logAction } from '../lib/leadsApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fullName, initials, formatDate } from '../lib/helpers';
import { PRODUCTS } from '../constants';

export default function LeadAssignment() {
  const { manager, isVP } = useAuth();
  const toast = useToast();

  const [leads, setLeads] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const load = useCallback(async () => {
    if (!isVP) { setLoading(false); return; }
    setLoading(true);
    const { rows } = await fetchLeads({ withDocuments: false, withBackgrounds: false });
    setLeads(rows);
    const { rows: mgrs } = await fetchManagers('id, first_name, last_name, email, key_area, ogt, expa_id');
    setManagers(mgrs);
    setLoading(false);
  }, [isVP]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (unassignedOnly && l.manager_id) return false;
      if (product && l.product !== product) return false;
      if (l.assigned_on_expa) return false;
      if (q) {
        const hay = [fullName(l), l.email, l.university, l.lead_id].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, product, unassignedOnly]);

  const workload = useMemo(() => {
    const map = {};
    leads.forEach((l) => { if (l.manager_id) map[l.manager_id] = (map[l.manager_id] || 0) + 1; });
    return map;
  }, [leads]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () =>
    setSelected((s) => (s.length === filtered.length ? [] : filtered.map((l) => l.id)));

  const assign = async () => {
    if (!target || !selected.length) {
      toast.error('Select a manager and at least one lead.');
      return;
    }
    if (!isSupabaseConfigured) { toast.error('Supabase is not configured.'); return; }
    setBusy(true);
    const { error } = await supabase
      .from('leads')
      .update({ manager_id: target, updated_at: new Date().toISOString() })
      .in('id', selected);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logAction(manager?.id, 'leads_assigned', { manager_id: target, count: selected.length });
    const targetName = managers.find((m) => m.id === target);
    setLastResult({
      count: selected.length,
      name: [targetName?.first_name, targetName?.last_name].filter(Boolean).join(' ')
    });
    toast.success(`${selected.length} lead(s) assigned.`);
    setSelected([]);
    load();
  };

  // Round-robin split across every manager in the chosen team.
  const autoDistribute = async () => {
    if (!selected.length) { toast.error('Select leads to distribute.'); return; }
    const pool = managers.filter((m) => m.key_area && m.key_area !== 'Administrator');
    if (!pool.length) { toast.error('No managers available.'); return; }
    setBusy(true);
    try {
      const sorted = [...pool].sort((a, b) => (workload[a.id] || 0) - (workload[b.id] || 0));
      for (let i = 0; i < selected.length; i += 1) {
        const to = sorted[i % sorted.length];
        // eslint-disable-next-line no-await-in-loop
        await supabase.from('leads').update({ manager_id: to.id }).eq('id', selected[i]);
      }
      await logAction(manager?.id, 'leads_auto_distributed', { count: selected.length });
      toast.success(`${selected.length} lead(s) distributed across ${sorted.length} manager(s).`);
      setSelected([]);
      load();
    } catch (err) {
      toast.error(err.message || 'Distribution failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!isVP) {
    return (
      <div className="access-denied">
        <FiLock /><h3>Access Denied</h3><p>Only VPs can access Lead Assignment.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Lead Assignment Dashboard</h1>
          <p className="page-subtitle">
            Reassign leads between managers. Leads marked as assigned on EXPA will not appear here again.
          </p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
        </div>
      </div>

      <div className="tile-grid">
        <div className="tile accent">
          <div className="tile-icon"><FiUsers /></div>
          <span className="tile-value">{leads.length}</span>
          <span className="tile-label">Total Leads</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiInbox /></div>
          <span className="tile-value">{leads.filter((l) => !l.manager_id).length}</span>
          <span className="tile-label">Total Unassigned</span>
        </div>
        <div className="tile">
          <div className="tile-icon"><FiUserCheck /></div>
          <span className="tile-value">{managers.length}</span>
          <span className="tile-label">Total Managers</span>
        </div>
        <div className="tile gold">
          <div className="tile-icon"><FiCheckSquare /></div>
          <span className="tile-value">{selected.length}</span>
          <span className="tile-label">Selected</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search for Leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><FiX /></button>}
        </div>
        <select value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">All products</option>
          {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label className="switch">
          <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
          <span>Show unassigned only</span>
        </label>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3><FiUsers /> Leads to Contact</h3>
            <span className="tile-sub">{filtered.length} shown</span>
          </div>
          {loading ? (
            <div className="loading-container"><div className="spinner" /><p>Loading leads...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FiInbox /><h3>No leads found</h3><p>Try adjusting your filters or check back later</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>
                      <button className="row-btn" onClick={toggleAll} aria-label="Select all">
                        {selected.length === filtered.length ? <FiCheckSquare /> : <FiSquare />}
                      </button>
                    </th>
                    <th>Name</th><th>Product</th><th>University</th><th>Current Manager</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <button className="row-btn" onClick={() => toggle(l.id)} aria-label="Select row">
                          {selected.includes(l.id) ? <FiCheckSquare /> : <FiSquare />}
                        </button>
                      </td>
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
                      <td>{l.university || '-'}</td>
                      <td>
                        {l.manager
                          ? [l.manager.first_name, l.manager.last_name].filter(Boolean).join(' ')
                          : <span className="badge badge-warning">Unassigned</span>}
                      </td>
                      <td>{formatDate(l.created_at) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiUserCheck /> Reassign to</h3></div>
            <div className="panel-body">
              <p className="tile-sub" style={{ marginBottom: '0.75rem' }}>
                Select multiple leads using checkboxes, then pick the manager who should own them.
              </p>
              <div className="field" style={{ marginBottom: '0.9rem' }}>
                <label>Manager</label>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Select a manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                      {` - ${workload[m.id] || 0} leads`}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={assign} disabled={busy || !selected.length || !target}>
                <FiUserCheck /> {busy ? 'Assigning...' : `Assign ${selected.length} lead(s)`}
              </button>
              <button
                className="btn btn-ghost"
                style={{ marginTop: '0.6rem', width: '100%' }}
                onClick={autoDistribute}
                disabled={busy || !selected.length}
              >
                <FiZap /> Auto-distribute evenly
              </button>

              {lastResult && (
                <div className="note" style={{ marginTop: '1rem' }}>
                  <p>Assignment Results</p>
                  <small>{lastResult.count} lead(s) assigned to {lastResult.name}</small>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiUsers /> Current Workload</h3></div>
            <div className="panel-body rank-list">
              {managers.map((m) => {
                const count = workload[m.id] || 0;
                const max = Math.max(1, ...Object.values(workload));
                return (
                  <div className="rank-row" key={m.id}>
                    <div className="rank-row-head">
                      <strong>{[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}</strong>
                      <span>{count}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {!managers.length && <p className="tile-sub">No managers found</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
