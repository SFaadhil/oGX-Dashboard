import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiX, FiClock, FiInbox, FiLock, FiRefreshCw, FiEye } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { logAction } from '../lib/leadsApi';
import { formatDateTime } from '../lib/helpers';

const TONE = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };

export default function Approvals() {
  const { manager, isTeamLeader } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !manager?.id) { setLoading(false); return; }
    setLoading(true);
    const column = isTeamLeader ? 'approver_id' : 'requester_id';
    const { data, error } = await supabase
      .from('approval_requests')
      .select(`
        id, status, created_at, lead_data, lead_id, approver_type,
        requester:requester_id (id, first_name, last_name, email)
      `)
      .eq(column, manager.id)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.id, isTeamLeader]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  const decide = async (row, status) => {
    const { error } = await supabase.from('approval_requests').update({ status }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    await logAction(manager?.id, `approval_${status}`, { request_id: row.id });
    toast.success(status === 'approved' ? 'Changes were approved and saved' : 'Request rejected.');
    load();
  };

  const parse = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
  };

  if (!isTeamLeader && !rows.length && !loading) {
    return (
      <div className="access-denied">
        <FiLock /><h3>No Requests Yet</h3>
        <p>Requests you raise on a lead will show up here while they wait for team leader approval.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Approval Requests</h1>
          <p className="page-subtitle">
            {isTeamLeader
              ? 'Changes your team members have asked you to sign off.'
              : 'Requests you have raised, and where they stand.'}
          </p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
        </div>
      </div>

      <div className="toolbar">
        {['pending', 'approved', 'rejected'].map((t) => (
          <button
            key={t}
            className={`chip${tab === t ? ' on' : ''}`}
            style={{ cursor: 'pointer', textTransform: 'capitalize', padding: '0.45rem 0.9rem' }}
            onClick={() => setTab(t)}
          >
            {t} ({rows.filter((r) => r.status === t).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading approval requests...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiInbox /><h3>No {tab === 'pending' ? 'Pending ' : ''}Requests</h3>
          <p>Nothing to review right now.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead</th><th>Requested By</th><th>Requested</th><th>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const payload = parse(r.lead_data);
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{payload.name || 'Lead'}</strong>
                        {payload.status && <div className="tile-sub">{payload.status}</div>}
                      </td>
                      <td>
                        {r.requester
                          ? [r.requester.first_name, r.requester.last_name].filter(Boolean).join(' ')
                          : '-'}
                      </td>
                      <td>{formatDateTime(r.created_at) || '-'}</td>
                      <td><span className={`badge ${TONE[r.status] || 'badge-neutral'}`}>{r.status}</span></td>
                      <td>
                        <div className="row-actions">
                          {r.lead_id && (
                            <Link className="row-btn" to={`/lead/${r.lead_id}`} title="View lead"><FiEye /></Link>
                          )}
                          {isTeamLeader && r.status === 'pending' && (
                            <>
                              <button className="row-btn" title="Approve" onClick={() => decide(r, 'approved')}>
                                <FiCheck />
                              </button>
                              <button className="row-btn" title="Reject" onClick={() => decide(r, 'rejected')}>
                                <FiX />
                              </button>
                            </>
                          )}
                          {!isTeamLeader && r.status === 'pending' && (
                            <span className="badge badge-warning"><FiClock /> Waiting</span>
                          )}
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
    </>
  );
}
