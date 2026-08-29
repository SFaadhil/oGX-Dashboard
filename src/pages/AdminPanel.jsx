import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiShield, FiUserPlus, FiEdit2, FiTrash2, FiLock, FiRefreshCw, FiTag, FiPlus,
  FiToggleLeft, FiToggleRight, FiActivity, FiSearch, FiX, FiDownloadCloud, FiClock
} from 'react-icons/fi';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchManagers, fetchBackgrounds, logAction } from '../lib/leadsApi';
import { initials, formatDateTime } from '../lib/helpers';
import { KEY_AREAS, OGT_TEAMS, DEFAULT_BACKGROUNDS } from '../constants';

const BLANK_MANAGER = {
  first_name: '', last_name: '', email: '', password: '', phone_number: '',
  key_area: '', ogt: '', expa_id: '', reports_to: ''
};

export default function AdminPanel() {
  const { manager, isVP } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('members');
  const [managers, setManagers] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [syncRuns, setSyncRuns] = useState([]);
  const [poolOpen, setPoolOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_MANAGER);
  const [newBackground, setNewBackground] = useState('');

  const load = useCallback(async () => {
    if (!isVP || !isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    const [{ rows: mgrs }, { rows: bgs }, logRes, settingRes, syncRes] = await Promise.all([
      fetchManagers(),
      fetchBackgrounds(),
      supabase
        .from('action_logs')
        .select('id, action, details, created_at, manager:manager_id (first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('app_settings').select('value').eq('key', 'cv_pool_open').maybeSingle(),
      supabase
        .from('sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(24)
    ]);
    setManagers(mgrs);
    setBackgrounds(bgs);
    setLogs(logRes.data || []);
    setSyncRuns(syncRes.data || []);
    setPoolOpen(!settingRes.data || String(settingRes.data.value) !== 'false');
    setLoading(false);
  }, [isVP]);

  useEffect(() => { load(); }, [load]);

  const filteredManagers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter((m) =>
      [m.first_name, m.last_name, m.email, m.key_area].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [managers, search]);

  const openEditor = (row) => {
    setEditing(row || 'new');
    setForm(row ? { ...BLANK_MANAGER, ...row, password: '' } : BLANK_MANAGER);
  };

  const saveManager = async () => {
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    payload.reports_to = payload.reports_to || null;
    payload.email = String(payload.email || '').trim().toLowerCase();
    delete payload.created_at;
    delete payload.last_login;

    if (editing === 'new') {
      if (!payload.email || !form.password) { toast.error('Email and password are required.'); return; }
      const { error } = await supabase.from('managers').insert(payload);
      if (error) { toast.error(error.message); return; }
    } else {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('managers').update(rest).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
    }
    await logAction(manager?.id, editing === 'new' ? 'manager_created' : 'manager_updated', { email: payload.email });
    toast.success('Saved.');
    setEditing(null);
    load();
  };

  const removeManager = async (row) => {
    const { error } = await supabase.from('managers').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    await logAction(manager?.id, 'manager_deleted', { email: row.email });
    toast.success('Team member removed.');
    load();
  };

  const addBackground = async () => {
    const name = newBackground.trim();
    if (!name) return;
    const { error } = await supabase.from('backgrounds').insert({ name });
    if (error) { toast.error(error.message); return; }
    setNewBackground('');
    toast.success('Background added.');
    load();
  };

  const seedBackgrounds = async () => {
    const existing = new Set(backgrounds.map((b) => b.name));
    const missing = DEFAULT_BACKGROUNDS.filter((n) => !existing.has(n)).map((name) => ({ name }));
    if (!missing.length) { toast.info('All default backgrounds already exist.'); return; }
    const { error } = await supabase.from('backgrounds').insert(missing);
    if (error) { toast.error(error.message); return; }
    toast.success(`${missing.length} background(s) added.`);
    load();
  };

  const removeBackground = async (row) => {
    const { error } = await supabase.from('backgrounds').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const togglePool = async () => {
    const next = poolOpen ? 'false' : 'true';
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'cv_pool_open', value: next }, { onConflict: 'key' });
    if (error) { toast.error(error.message); return; }
    setPoolOpen(!poolOpen);
    await logAction(manager?.id, 'cv_pool_toggled', { open: next });
    toast.success(`CV pool ${poolOpen ? 'closed' : 'opened'}.`);
  };

  if (!isVP) {
    return (
      <div className="access-denied">
        <FiLock /><h3>Access Denied</h3><p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading admin panel...</p></div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><FiShield style={{ verticalAlign: '-2px' }} /> Admin Panel</h1>
          <p className="page-subtitle">Team members, backgrounds, CV pool access and the audit trail.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
          <button className="btn btn-primary" onClick={() => openEditor(null)}><FiUserPlus /> Add member</button>
        </div>
      </div>

      <div className="toolbar">
        {[
          ['members', 'Team Members'],
          ['backgrounds', 'Backgrounds'],
          ['access', 'CV Pool Access'],
          ['sync', 'EXPA Sync'],
          ['logs', 'Activity']
        ].map(([key, label]) => (
          <button
            key={key}
            className={`chip${tab === key ? ' on' : ''}`}
            style={{ cursor: 'pointer', padding: '0.45rem 0.9rem' }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
        {tab === 'members' && (
          <div className="search-wrapper">
            <FiSearch className="search-icon" />
            <input
              className="search-input"
              placeholder="Search team members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')}><FiX /></button>}
          </div>
        )}
      </div>

      {tab === 'members' && (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th><th>Key Area</th><th>oGT</th><th>EXPA ID</th>
                  <th>Reports To</th><th>Last Login</th><th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredManagers.map((m) => {
                  const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
                  const lead = managers.find((x) => x.id === m.reports_to);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="lead-name-cell">
                          <span className="mini-avatar">{initials(name)}</span>
                          <span><strong>{name}</strong><span>{m.email}</span></span>
                        </div>
                      </td>
                      <td>{m.key_area || '-'}</td>
                      <td>{m.ogt || '-'}</td>
                      <td>{m.expa_id || '-'}</td>
                      <td>{lead ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') : '-'}</td>
                      <td>{formatDateTime(m.last_login) || 'Never'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="row-btn" onClick={() => openEditor(m)}><FiEdit2 /></button>
                          <button className="row-btn" onClick={() => removeManager(m)}><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'backgrounds' && (
        <div className="panel">
          <div className="panel-head">
            <h3><FiTag /> Backgrounds ({backgrounds.length})</h3>
            <button className="btn btn-sm btn-ghost" onClick={seedBackgrounds}>Seed defaults</button>
          </div>
          <div className="panel-body">
            <div className="toolbar" style={{ margin: 0, marginBottom: '1rem' }}>
              <input
                className="search-input"
                style={{ paddingLeft: '1rem' }}
                placeholder="New background name"
                value={newBackground}
                onChange={(e) => setNewBackground(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBackground()}
              />
              <button className="btn btn-primary" onClick={addBackground}><FiPlus /> Add Background</button>
            </div>
            <div className="chip-row">
              {backgrounds.map((b) => (
                <span className="chip removable" key={b.id}>
                  {b.name}
                  <button onClick={() => removeBackground(b)} aria-label="Remove"><FiX /></button>
                </span>
              ))}
              {!backgrounds.length && <p className="tile-sub">No backgrounds found</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'access' && (
        <div className="panel">
          <div className="panel-head"><h3><FiShield /> CV Pool Access</h3></div>
          <div className="panel-body">
            <p className="tile-sub" style={{ marginBottom: '1rem' }}>
              When closed, visitors to /cv-pool see the &quot;currently closed&quot; notice instead of the talent grid.
            </p>
            <button className="btn btn-primary" onClick={togglePool}>
              {poolOpen ? <FiToggleRight /> : <FiToggleLeft />}
              {poolOpen ? 'Close the CV pool' : 'Open the CV pool'}
            </button>
            <div className="note" style={{ marginTop: '1rem' }}>
              <p>Status: {poolOpen ? 'Open to the public' : 'Closed'}</p>
              <small>Changes take effect on the visitor&apos;s next page load.</small>
            </div>
          </div>
        </div>
      )}

      {tab === 'sync' && <SyncPanel runs={syncRuns} />}

      {tab === 'logs' && (
        <div className="panel">
          <div className="panel-head"><h3><FiActivity /> Recent Activity</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDateTime(l.created_at)}</td>
                    <td>
                      {l.manager
                        ? [l.manager.first_name, l.manager.last_name].filter(Boolean).join(' ')
                        : 'System'}
                    </td>
                    <td><span className="badge badge-neutral">{l.action}</span></td>
                    <td style={{ maxWidth: 420, wordBreak: 'break-all' }}>{l.details}</td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>No activity yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing === 'new' ? 'Add team member' : 'Edit team member'}
        onClose={() => setEditing(null)}
        width={720}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveManager}>Save</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label>First Name</label>
            <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Last Name</label>
            <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="field">
            <label>{editing === 'new' ? 'Password' : 'New password (optional)'}</label>
            <input type="text" value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="field">
            <label>Phone Number</label>
            <input value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} />
          </div>
          <div className="field">
            <label>EXPA ID</label>
            <input value={form.expa_id} onChange={(e) => setForm((f) => ({ ...f, expa_id: e.target.value }))} />
          </div>
          <div className="field">
            <label>Key Area</label>
            <select value={form.key_area} onChange={(e) => setForm((f) => ({ ...f, key_area: e.target.value }))}>
              <option value="">Select key area</option>
              {KEY_AREAS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label>oGT Team</label>
            <select value={form.ogt} onChange={(e) => setForm((f) => ({ ...f, ogt: e.target.value }))}>
              <option value="">No oGT selected...</option>
              {OGT_TEAMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field full">
            <label>Reports To</label>
            <select value={form.reports_to || ''} onChange={(e) => setForm((f) => ({ ...f, reports_to: e.target.value }))}>
              <option value="">Nobody</option>
              {managers
                .filter((m) => m.id !== (editing?.id || ''))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Health of the hourly EXPA pull. */
function SyncPanel({ runs }) {
  const last = runs[0];
  const lastSuccess = runs.find((r) => r.status === 'success');
  const ageMinutes = lastSuccess
    ? Math.round((Date.now() - new Date(lastSuccess.finished_at || lastSuccess.started_at).getTime()) / 60000)
    : null;
  const stale = ageMinutes === null || ageMinutes > 90;

  return (
    <>
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
          <span className="tile-value">{runs.filter((r) => r.status === 'success').length}/{runs.length}</span>
          <span className="tile-label">Recent runs succeeded</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3><FiDownloadCloud /> Recent EXPA syncs</h3></div>
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
                    No sync has run yet. See README - &quot;Live EXPA sync&quot;.
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
