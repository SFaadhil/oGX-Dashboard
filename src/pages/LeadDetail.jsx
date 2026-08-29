import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiMail, FiPhone, FiLinkedin, FiFileText, FiExternalLink,
  FiAlertCircle, FiEye, FiUser, FiBriefcase, FiClock
} from 'react-icons/fi';
import Modal from '../components/Modal';
import { supabase, isSupabaseConfigured, publicFileUrl } from '../lib/supabaseClient';
import { fullName, formatDate, formatDateTime, initials, toArray, yearLabel } from '../lib/helpers';
import { STATUS_TONE } from '../constants';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

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

    const [bgRes, docRes] = await Promise.all([
      supabase.from('lead_backgrounds').select('backgrounds(id, name)').eq('lead_id', id),
      supabase.from('lead_documents').select('*').eq('lead_id', id).order('uploaded_at', { ascending: false })
    ]);

    setLead({ ...data, backgrounds: (bgRes.data || []).map((r) => r.backgrounds).filter(Boolean) });
    setDocuments(docRes.data || []);
    setError(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading lead...</p></div>;
  }
  if (error || !lead) {
    return (
      <div className="empty-state">
        <FiAlertCircle /><h3>Not found</h3><p>{error || 'Lead not found.'}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  const cv = documents.find((d) => !d.doc_type || String(d.doc_type).toLowerCase().includes('cv'));
  const cvUrl = cv ? publicFileUrl(cv.file_url) : null;
  const manager = lead.manager;

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
          {lead.email && (
            <a className="btn btn-ghost" href={`mailto:${lead.email}`}><FiMail /> Email</a>
          )}
          {lead.linkedin_url && (
            <a className="btn btn-ghost" href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
              <FiLinkedin /> LinkedIn
            </a>
          )}
          {cvUrl && (
            <button className="btn btn-primary" onClick={() => setPreview(cvUrl)}><FiEye /> View CV</button>
          )}
        </div>
      </div>

      <div className="two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiUser /> Applicant</h3></div>
            <div className="panel-body">
              <div className="kv-grid">
                <div className="kv-item"><span>EP ID</span><strong>{lead.lead_id || '-'}</strong></div>
                <div className="kv-item"><span>Email</span><strong>{lead.email || '-'}</strong></div>
                <div className="kv-item"><span>Phone</span><strong>{lead.phone_number || '-'}</strong></div>
                <div className="kv-item"><span>Gender</span><strong>{lead.gender || '-'}</strong></div>
                <div className="kv-item"><span>Date of Birth</span><strong>{formatDate(lead.date_of_birth) || '-'}</strong></div>
                <div className="kv-item"><span>Home LC</span><strong>{lead.home_lc || '-'}</strong></div>
                <div className="kv-item"><span>Year of Studies</span><strong>{yearLabel(lead.year_of_studies) || '-'}</strong></div>
                <div className="kv-item"><span>Is AIESECer</span><strong>{lead.is_aiesecer ? 'Yes' : 'No'}</strong></div>
              </div>

              <h4 className="section-heading">Backgrounds</h4>
              <div className="chip-row">
                {lead.backgrounds.map((b) => <span className="chip on" key={b.id}>{b.name}</span>)}
                {!lead.backgrounds.length && <span className="chip">Not specified</span>}
              </div>

              <h4 className="section-heading">Preferences</h4>
              <div className="chip-row">
                {toArray(lead.desired_regions).map((r) => <span className="chip on" key={r}>{r}</span>)}
                {toArray(lead.desired_countries).map((c) => <span className="chip" key={c}>{c}</span>)}
                {!toArray(lead.desired_regions).length && !toArray(lead.desired_countries).length && (
                  <span className="chip">Not specified</span>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiBriefcase /> Application</h3></div>
            <div className="panel-body">
              <div className="kv-grid">
                <div className="kv-item"><span>Opportunity</span><strong>{lead.opportunity_title || '-'}</strong></div>
                <div className="kv-item"><span>Sub product</span><strong>{lead.sub_product || '-'}</strong></div>
                <div className="kv-item"><span>Host LC</span><strong>{lead.host_lc || '-'}</strong></div>
                <div className="kv-item"><span>Host MC</span><strong>{lead.host_mc || '-'}</strong></div>
                <div className="kv-item"><span>Duration</span><strong>{lead.duration || '-'}</strong></div>
                <div className="kv-item"><span>Starts</span><strong>{formatDate(lead.start_date) || '-'}</strong></div>
                <div className="kv-item"><span>Ends</span><strong>{formatDate(lead.experience_end_date) || '-'}</strong></div>
                <div className="kv-item"><span>EXPA status</span><strong>{lead.expa_status || '-'}</strong></div>
                <div className="kv-item"><span>Applied</span><strong>{formatDate(lead.applied_at || lead.created_at) || '-'}</strong></div>
              </div>

              {lead.opportunity_id && (
                <a
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: '1rem' }}
                  href={`https://expa.aiesec.org/opportunities/${lead.opportunity_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FiExternalLink /> View opportunity on EXPA
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiUser /> EP Manager</h3></div>
            <div className="panel-body">
              {manager ? (
                <>
                  <div className="lead-name-cell" style={{ marginBottom: '0.9rem' }}>
                    <span className="mini-avatar">
                      {initials([manager.first_name, manager.last_name].filter(Boolean).join(' '))}
                    </span>
                    <span>
                      <strong>{[manager.first_name, manager.last_name].filter(Boolean).join(' ')}</strong>
                      <span>{manager.key_area || 'oGX'}</span>
                    </span>
                  </div>
                  <div className="chip-row">
                    {manager.email && (
                      <a className="btn btn-sm btn-ghost" href={`mailto:${manager.email}`}><FiMail /> Email</a>
                    )}
                    {manager.phone_number && (
                      <a className="btn btn-sm btn-ghost" href={`tel:${manager.phone_number}`}><FiPhone /> Call</a>
                    )}
                  </div>
                </>
              ) : (
                <p className="tile-sub">No EP manager assigned on EXPA.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiFileText /> Curriculum Vitae</h3></div>
            <div className="panel-body">
              {cvUrl ? (
                <div className="doc-row">
                  <FiFileText />
                  <div>
                    <strong>CV on file</strong>
                    <small>{formatDate(cv.uploaded_at)}</small>
                  </div>
                  <a className="row-btn" href={cvUrl} target="_blank" rel="noopener noreferrer">
                    <FiExternalLink />
                  </a>
                </div>
              ) : (
                <p className="tile-sub">No CV available for this application.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiClock /> Sync</h3></div>
            <div className="panel-body">
              <div className="kv-grid">
                <div className="kv-item"><span>Source</span><strong>{lead.source || 'manual'}</strong></div>
                <div className="kv-item"><span>Last synced</span><strong>{formatDateTime(lead.synced_at) || '-'}</strong></div>
                <div className="kv-item"><span>EXPA application</span><strong>{lead.expa_application_id || '-'}</strong></div>
                <div className="kv-item"><span>In CV pool</span><strong>{lead.show_in_cvpool ? 'Yes' : 'No'}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
