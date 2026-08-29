import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiEdit2, FiMail, FiPhone, FiLinkedin, FiUploadCloud, FiFileText,
  FiSend, FiCheckCircle, FiExternalLink, FiAlertCircle, FiEye
} from 'react-icons/fi';
import Modal from '../components/Modal';
import LeadEditor from '../components/LeadEditor';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured, publicFileUrl, uploadFile } from '../lib/supabaseClient';
import { fetchManagers, logAction } from '../lib/leadsApi';
import { fullName, formatDate, formatDateTime, initials, toArray, yearLabel } from '../lib/helpers';
import { STATUS_TONE, LEAD_STATUSES, FEEDBACK_STATUSES } from '../constants';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { manager, isTeamLeader } = useAuth();

  const [lead, setLead] = useState(null);
  const [managers, setManagers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('leads')
      .select('*, manager:manager_id (id, first_name, last_name, email, phone_number, key_area, ogt)')
      .eq('id', id)
      .maybeSingle();
    if (err || !data) {
      setError(err?.message || 'Lead not found.');
      setLoading(false);
      return;
    }

    const [bgRes, noteRes, docRes, proofRes, mgrRes] = await Promise.all([
      supabase.from('lead_backgrounds').select('backgrounds(id, name)').eq('lead_id', id),
      supabase
        .from('lead_notes')
        .select('id, note, created_at, manager:manager_id (first_name, last_name)')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('lead_documents').select('*').eq('lead_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('lead_proofs').select('*').eq('lead_id', id).order('uploaded_at', { ascending: false }),
      fetchManagers('id, first_name, last_name, email, key_area, ogt')
    ]);

    setLead({ ...data, backgrounds: (bgRes.data || []).map((r) => r.backgrounds).filter(Boolean) });
    setNotes(noteRes.data || []);
    setDocuments(docRes.data || []);
    setProofs(proofRes.data || []);
    setManagers(mgrRes.rows);
    setError(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = async (values, label) => {
    const { error: err } = await supabase.from('leads').update(values).eq('id', id);
    if (err) { toast.error(err.message); return; }
    await logAction(manager?.id, label, { lead_id: id, ...values });
    toast.success('Lead updated.');
    load();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const { error: err } = await supabase
      .from('lead_notes')
      .insert({ lead_id: id, manager_id: manager?.id, note: noteText.trim() });
    if (err) { toast.error(err.message); return; }
    setNoteText('');
    toast.success('Note added.');
    load();
  };

  const upload = async (file, table) => {
    if (!file) return;
    setUploading(true);
    try {
      const { path } = await uploadFile(file, table === 'lead_documents' ? 'cv' : 'proof');
      let err;
      if (table === 'lead_documents') {
        // One manual CV per lead: replace the previous upload rather than
        // stacking rows. The synced EXPA copy lives alongside it (source
        // 'expa'), and the newer row is what the UI shows.
        ({ error: err } = await supabase.from('lead_documents').upsert(
          {
            lead_id: id,
            file_url: path,
            doc_type: 'cv',
            source: 'upload',
            uploaded_at: new Date().toISOString()
          },
          { onConflict: 'lead_id,doc_type,source' }
        ));
      } else {
        ({ error: err } = await supabase
          .from('lead_proofs')
          .insert({ lead_id: id, file_url: path, uploaded_at: new Date().toISOString() }));
      }
      if (err) throw err;
      toast.success('File uploaded.');
      load();
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Members request approval; team leaders and VPs act on the request.
  const requestApproval = async () => {
    const { error: err } = await supabase.from('approval_requests').insert({
      lead_id: id,
      requester_id: manager?.id,
      approver_id: manager?.reports_to || null,
      approver_type: 'team_leader',
      status: 'pending',
      lead_data: JSON.stringify({ name: fullName(lead), status: lead.status })
    });
    if (err) { toast.error(err.message); return; }
    toast.success('Approval requested. Waiting for team leader approval.');
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading lead...</p></div>;
  }
  if (error || !lead) {
    return (
      <div className="empty-state">
        <FiAlertCircle /><h3>No Results</h3><p>{error || 'Lead not found.'}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  const cv = documents.find((d) => !d.doc_type || String(d.doc_type).toLowerCase().includes('cv'));

  return (
    <>
      <div className="page-head">
        <div className="lead-hero">
          <button className="row-btn" onClick={() => navigate(-1)} title="Back"><FiArrowLeft /></button>
          <div className="hero-avatar">{initials(fullName(lead))}</div>
          <div>
            <h1 className="page-title">{fullName(lead)}</h1>
            <p className="page-subtitle">
              {lead.university || 'University not specified'}
              {yearLabel(lead.year_of_studies) ? ` - ${yearLabel(lead.year_of_studies)}` : ''}
            </p>
          </div>
          {lead.product && <span className={`product-badge product-${lead.product}`}>{lead.product}</span>}
          <span className={`badge ${STATUS_TONE[lead.status] || 'badge-neutral'}`}>
            {lead.status || 'Not Contacted'}
          </span>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(true)}><FiEdit2 /> Edit Information</button>
          {!isTeamLeader && (
            <button className="btn btn-ghost" onClick={requestApproval}><FiSend /> Request Approval</button>
          )}
          {cv && (
            <button className="btn btn-primary" onClick={() => setPreview(publicFileUrl(cv.file_url))}>
              <FiEye /> View CV
            </button>
          )}
        </div>
      </div>

      <div className="two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiFileText /> Lead Information</h3></div>
            <div className="panel-body">
              <div className="kv-grid">
                <div className="kv-item"><span>EP ID</span><strong>{lead.lead_id || '-'}</strong></div>
                <div className="kv-item"><span>EXPA ID</span><strong>{lead.expa_id || '-'}</strong></div>
                <div className="kv-item"><span>Email</span><strong>{lead.email || '-'}</strong></div>
                <div className="kv-item"><span>Phone</span><strong>{lead.phone_number || '-'}</strong></div>
                <div className="kv-item"><span>Gender</span><strong>{lead.gender || '-'}</strong></div>
                <div className="kv-item"><span>Date of Birth</span><strong>{formatDate(lead.date_of_birth) || '-'}</strong></div>
                <div className="kv-item"><span>Home LC</span><strong>{lead.home_lc || '-'}</strong></div>
                <div className="kv-item"><span>Duration</span><strong>{lead.duration || '-'}</strong></div>
                <div className="kv-item"><span>Start date</span><strong>{formatDate(lead.start_date) || '-'}</strong></div>
                <div className="kv-item"><span>Is AIESECer</span><strong>{lead.is_aiesecer ? 'Yes' : 'No'}</strong></div>
                <div className="kv-item"><span>Created</span><strong>{formatDate(lead.created_at) || '-'}</strong></div>
                <div className="kv-item"><span>Last Updated</span><strong>{formatDate(lead.updated_at) || '-'}</strong></div>
              </div>

              <h4 className="section-heading">Desired Regions</h4>
              <div className="chip-row">
                {toArray(lead.desired_regions).map((r) => <span className="chip on" key={r}>{r}</span>)}
                {!toArray(lead.desired_regions).length && <span className="chip">Not specified</span>}
              </div>

              <h4 className="section-heading">Desired Countries</h4>
              <div className="chip-row">
                {toArray(lead.desired_countries).map((c) => <span className="chip" key={c}>{c}</span>)}
                {!toArray(lead.desired_countries).length && <span className="chip">Not specified</span>}
              </div>

              <h4 className="section-heading">Lead Backgrounds</h4>
              <div className="chip-row">
                {lead.backgrounds.map((b) => <span className="chip" key={b.id}>{b.name}</span>)}
                {!lead.backgrounds.length && <span className="chip">No backgrounds selected</span>}
              </div>

              <h4 className="section-heading">Contact</h4>
              <div className="chip-row">
                {lead.email && (
                  <a className="btn btn-sm btn-ghost" href={`mailto:${lead.email}`}><FiMail /> Email</a>
                )}
                {lead.phone_number && (
                  <a className="btn btn-sm btn-ghost" href={`tel:${lead.phone_number}`}><FiPhone /> Call</a>
                )}
                {lead.linkedin_url && (
                  <a className="btn btn-sm btn-ghost" href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                    <FiLinkedin /> LinkedIn
                  </a>
                )}
                {lead.expa_id && (
                  <a
                    className="btn btn-sm btn-ghost"
                    href={`https://expa.aiesec.org/people/${lead.expa_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FiExternalLink /> View on EXPA
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiFileText /> Notes</h3></div>
            <div className="panel-body">
              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <textarea
                  placeholder="Add a note about this lead..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!noteText.trim()}>
                <FiSend /> Add note
              </button>

              <div className="note-list" style={{ marginTop: '1rem' }}>
                {notes.map((n) => (
                  <div className="note" key={n.id}>
                    <p>{n.note}</p>
                    <small>
                      {n.manager ? [n.manager.first_name, n.manager.last_name].filter(Boolean).join(' ') : 'Unknown'}
                      {' - '}{formatDateTime(n.created_at)}
                    </small>
                  </div>
                ))}
                {!notes.length && <p className="tile-sub">No notes yet</p>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3>Assignment</h3></div>
            <div className="panel-body">
              <div className="field" style={{ marginBottom: '0.9rem' }}>
                <label>Current Manager</label>
                <select
                  value={lead.manager_id || ''}
                  onChange={(e) => patch({ manager_id: e.target.value || null }, 'lead_reassigned')}
                >
                  <option value="">Unassigned</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                      {m.key_area ? ` (${m.key_area})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: '0.9rem' }}>
                <label>Status</label>
                <select value={lead.status || ''} onChange={(e) => patch({ status: e.target.value }, 'status_changed')}>
                  {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="field" style={{ marginBottom: '0.9rem' }}>
                <label>Manager Feedback</label>
                <select
                  value={lead.feedback_status || 'pending'}
                  onChange={(e) => patch({ feedback_status: e.target.value }, 'feedback_changed')}
                >
                  {FEEDBACK_STATUSES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div className="switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(lead.assigned_on_expa)}
                    onChange={(e) => patch({ assigned_on_expa: e.target.checked }, 'expa_toggle')}
                  />
                  <span>Assigned on EXPA</span>
                </label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(lead.show_in_cvpool)}
                    onChange={(e) => patch({ show_in_cvpool: e.target.checked }, 'cvpool_toggle')}
                  />
                  <span>Show in CV Pool</span>
                </label>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiFileText /> Curriculum Vitae</h3></div>
            <div className="panel-body">
              {cv ? (
                <div className="doc-row">
                  <FiFileText />
                  <div>
                    <strong>Current CV uploaded</strong>
                    <small>{formatDate(cv.uploaded_at)}</small>
                  </div>
                  <a className="row-btn" href={publicFileUrl(cv.file_url)} target="_blank" rel="noopener noreferrer">
                    <FiExternalLink />
                  </a>
                </div>
              ) : (
                <p className="tile-sub">No CV uploaded yet</p>
              )}

              <label className="btn btn-ghost cv-upload-btn" style={{ marginTop: '0.75rem' }}>
                <FiUploadCloud /> {uploading ? 'Uploading...' : 'Upload New CV'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  hidden
                  onChange={(e) => upload(e.target.files?.[0], 'lead_documents')}
                />
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiCheckCircle /> Proofs</h3></div>
            <div className="panel-body">
              {proofs.map((p) => (
                <div className="doc-row" key={p.id}>
                  <FiFileText />
                  <div>
                    <strong>{p.description || 'Proof'}</strong>
                    <small>{formatDate(p.uploaded_at)}</small>
                  </div>
                  <a className="row-btn" href={publicFileUrl(p.file_url)} target="_blank" rel="noopener noreferrer">
                    <FiExternalLink />
                  </a>
                </div>
              ))}
              {!proofs.length && <p className="tile-sub">No proofs uploaded yet</p>}

              <label className="btn btn-ghost cv-upload-btn" style={{ marginTop: '0.75rem' }}>
                <FiUploadCloud /> Upload New Proof
                <input type="file" hidden onChange={(e) => upload(e.target.files?.[0], 'lead_proofs')} />
              </label>
            </div>
          </div>
        </div>
      </div>

      <LeadEditor
        lead={editing ? lead : null}
        managers={managers}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); }}
      />

      <Modal
        open={Boolean(preview)}
        title={`${fullName(lead)} - Curriculum Vitae`}
        onClose={() => setPreview(null)}
        width={960}
        footer={
          preview && (
            <a className="btn btn-primary" href={preview} target="_blank" rel="noopener noreferrer">
              <FiExternalLink /> Open in new tab
            </a>
          )
        }
      >
        {preview
          ? <iframe className="cv-frame" src={preview} title="Curriculum Vitae" />
          : <p className="cv-frame-empty">CV not available</p>}
      </Modal>
    </>
  );
}
