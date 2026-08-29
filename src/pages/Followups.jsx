import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiCheckSquare, FiSquare, FiPlus, FiTrash2, FiSearch, FiX, FiInbox, FiRefreshCw
} from 'react-icons/fi';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchLeads } from '../lib/leadsApi';
import { fullName, formatDate } from '../lib/helpers';
import { PRIORITIES } from '../constants';

const PRIORITY_TONE = {
  Urgent: 'badge-danger',
  High: 'badge-warning',
  Medium: 'badge-info',
  Default: 'badge-neutral'
};

export default function Followups() {
  const { manager, isVP } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [priority, setPriority] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ application_id: '', notes: '', priority: 'Default' });

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    let query = supabase
      .from('followups')
      .select('id, application_id, notes, priority, done, manager_id, created_at')
      .order('created_at', { ascending: false });
    if (!isVP) query = query.eq('manager_id', manager?.id);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setRows(data || []);

    const { rows: leadRows } = await fetchLeads({
      filter: (q) => (isVP ? q : q.eq('manager_id', manager?.id)),
      withBackgrounds: false,
      withDocuments: false
    });
    setLeads(leadRows);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.id, isVP]);

  useEffect(() => { load(); }, [load]);

  const leadIndex = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      if (l.lead_id) map[String(l.lead_id)] = l;
      map[String(l.id)] = l;
    });
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showDone && r.done) return false;
      if (priority && (r.priority || 'Default') !== priority) return false;
      if (q) {
        const lead = leadIndex[String(r.application_id)];
        const hay = [r.notes, r.application_id, lead && fullName(lead)]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, showDone, priority, leadIndex]);

  const toggleDone = async (row) => {
    const { error } = await supabase.from('followups').update({ done: !row.done }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (row) => {
    const { error } = await supabase.from('followups').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Follow-up removed.');
    load();
  };

  const create = async () => {
    if (!draft.application_id) { toast.error('Pick a lead first.'); return; }
    const { error } = await supabase.from('followups').insert({
      application_id: draft.application_id,
      notes: draft.notes || null,
      priority: draft.priority,
      done: false,
      manager_id: manager?.id
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Follow-up added.');
    setCreating(false);
    setDraft({ application_id: '', notes: '', priority: 'Default' });
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Follow Ups</h1>
          <p className="page-subtitle">Everything you promised to come back to.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><FiPlus /> New follow-up</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search follow-ups"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><FiX /></button>}
        </div>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label className="switch">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          <span>Show completed</span>
        </label>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading your requests...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiInbox /><h3>No follow-up records found</h3>
          <p>Add one from a lead you need to chase.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }} />
                  <th>Lead</th><th>EP ID</th><th>Notes</th><th>Priority</th><th>Created</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const lead = leadIndex[String(r.application_id)];
                  return (
                    <tr key={r.id} style={r.done ? { opacity: 0.55 } : undefined}>
                      <td>
                        <button className="row-btn" onClick={() => toggleDone(r)} title="Toggle done">
                          {r.done ? <FiCheckSquare /> : <FiSquare />}
                        </button>
                      </td>
                      <td>{lead ? fullName(lead) : 'Unknown lead'}</td>
                      <td>{r.application_id}</td>
                      <td style={{ maxWidth: 380, whiteSpace: 'pre-wrap' }}>{r.notes || '-'}</td>
                      <td>
                        <span className={`badge ${PRIORITY_TONE[r.priority] || 'badge-neutral'}`}>
                          {r.priority || 'Default'}
                        </span>
                      </td>
                      <td>{formatDate(r.created_at) || '-'}</td>
                      <td>
                        <button className="row-btn" onClick={() => remove(r)} title="Delete"><FiTrash2 /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={creating}
        title="New follow-up"
        onClose={() => setCreating(false)}
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create}><FiPlus /> Add</button>
          </>
        }
      >
        <div className="field" style={{ marginBottom: '0.9rem' }}>
          <label>Lead</label>
          <select
            value={draft.application_id}
            onChange={(e) => setDraft((d) => ({ ...d, application_id: e.target.value }))}
          >
            <option value="">Select a lead</option>
            {leads.map((l) => (
              <option key={l.id} value={l.lead_id || l.id}>
                {fullName(l)}{l.lead_id ? ` (${l.lead_id})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: '0.9rem' }}>
          <label>Priority</label>
          <select value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="What needs to happen next?"
          />
        </div>
      </Modal>
    </>
  );
}
