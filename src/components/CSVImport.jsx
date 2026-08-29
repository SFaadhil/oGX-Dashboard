import { useMemo, useRef, useState } from 'react';
import { FiUploadCloud, FiArrowRight, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Modal from './Modal';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { logAction } from '../lib/leadsApi';
import { parseCSV } from '../lib/helpers';

const TARGET_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'full_name', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'lead_id', label: 'EP ID' },
  { key: 'university', label: 'University' },
  { key: 'product', label: 'Product' },
  { key: 'year_of_studies', label: 'Year of Studies' },
  { key: 'duration', label: 'Duration' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'status', label: 'Status' },
  { key: 'home_lc', label: 'Host LC' }
];

// Header text -> database column, applied when a CSV is first parsed.
const AUTO_MAP = {
  'first name': 'first_name', firstname: 'first_name',
  'last name': 'last_name', lastname: 'last_name', surname: 'last_name',
  name: 'full_name', 'full name': 'full_name',
  email: 'email', 'e-mail': 'email', mail: 'email',
  phone: 'phone_number', 'phone number': 'phone_number', mobile: 'phone_number',
  'ep id': 'lead_id', id: 'lead_id', 'application id': 'lead_id',
  university: 'university', college: 'university',
  product: 'product', programme: 'product', program: 'product',
  'year of studies': 'year_of_studies', year: 'year_of_studies',
  duration: 'duration', linkedin: 'linkedin_url', 'linkedin url': 'linkedin_url',
  status: 'status', lc: 'home_lc', 'home lc': 'home_lc'
};

export default function CSVImport({ open, managers = [], onClose, onImported }) {
  const toast = useToast();
  const { manager } = useAuth();
  const inputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [rows, setRows] = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState({});
  const [assignTo, setAssignTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [drag, setDrag] = useState(false);

  const headers = useMemo(() => {
    if (!rows.length) return [];
    return hasHeader ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`);
  }, [rows, hasHeader]);

  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  const reset = () => {
    setStep(1); setRows([]); setMapping({}); setResult(null); setAssignTo(''); setHasHeader(true);
  };

  const readFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File is larger than 10MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result));
      if (!parsed.length) { toast.error('That CSV appears to be empty.'); return; }
      setRows(parsed);
      const auto = {};
      parsed[0].forEach((h, i) => {
        const key = AUTO_MAP[String(h).trim().toLowerCase()];
        if (key) auto[i] = key;
      });
      setMapping(auto);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const buildPayload = () =>
    dataRows.map((row) => {
      const out = {};
      Object.entries(mapping).forEach(([idx, field]) => {
        if (!field) return;
        const value = String(row[Number(idx)] ?? '').trim();
        if (value) out[field] = value;
      });
      if (!out.full_name && (out.first_name || out.last_name)) {
        out.full_name = [out.first_name, out.last_name].filter(Boolean).join(' ');
      }
      if (out.full_name && !out.first_name) {
        const parts = out.full_name.split(/\s+/);
        out.first_name = parts[0];
        out.last_name = parts.slice(1).join(' ') || null;
      }
      if (out.product && !['GTa', 'GTe'].includes(out.product)) {
        const p = out.product.toLowerCase();
        out.product = p.includes('gte') || p.includes('teach') ? 'GTe' : 'GTa';
      }
      if (assignTo) out.manager_id = assignTo;
      out.status = out.status || 'Not Contacted';
      out.created_at = new Date().toISOString();
      return out;
    });

  const valid = useMemo(
    () => buildPayload().filter((r) => r.first_name || r.full_name || r.email),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataRows, mapping, assignTo]
  );

  const runImport = async () => {
    if (!isSupabaseConfigured) { toast.error('Supabase is not configured.'); return; }
    setBusy(true);
    try {
      const chunks = [];
      for (let i = 0; i < valid.length; i += 200) chunks.push(valid.slice(i, i + 200));
      let inserted = 0;
      for (const chunk of chunks) {
        const { error } = await supabase.from('leads').insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      await logAction(manager?.id, 'csv_import', { inserted });
      setResult({ inserted, skipped: dataRows.length - valid.length });
      setStep(4);
      toast.success(`${inserted} lead(s) imported.`);
    } catch (err) {
      toast.error(err.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Import Leads from CSV"
      onClose={() => { reset(); onClose?.(); }}
      width={900}
      footer={
        step === 1 ? null : step === 2 ? (
          <>
            <button className="btn btn-ghost" onClick={reset}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!mappedCount}>
              Proceed to Field Mapping <FiArrowRight />
            </button>
          </>
        ) : step === 3 ? (
          <>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" onClick={runImport} disabled={busy || !valid.length}>
              {busy ? 'Importing...' : `Import ${valid.length} lead(s)`}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => { reset(); onImported?.(); }}>Done</button>
        )
      }
    >
      {step === 1 && (
        <>
          <div
            className={`dropzone${drag ? ' drag' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
          >
            <FiUploadCloud />
            <strong>Drag &amp; drop your CSV file here</strong>
            <span>Supported format: .csv (max 10MB)</span>
            <span className="btn btn-ghost btn-sm">Browse Files</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => readFile(e.target.files?.[0])}
          />
        </>
      )}

      {step === 2 && (
        <>
          <label className="switch">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            <span>First row contains column headers</span>
          </label>
          <h4 className="section-heading">Preview (first 5 rows)</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{headers.map((_, j) => <td key={j}>{r[j]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tile-sub">{dataRows.length} data row(s) detected.</p>
        </>
      )}

      {step === 3 && (
        <>
          <h4 className="section-heading">Map Columns to Database Fields</h4>
          <div className="form-grid">
            {headers.map((h, i) => (
              <div className="field" key={i}>
                <label>{h}</label>
                <select
                  value={mapping[i] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                >
                  <option value="">Select field...</option>
                  {TARGET_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h4 className="section-heading">Assignment</h4>
          <div className="field">
            <label>Assign all imported leads to</label>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Leave unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                </option>
              ))}
            </select>
          </div>

          <div className="import-summary">
            <div><strong>{mappedCount}</strong><span>Mapped</span></div>
            <div><strong>{valid.length}</strong><span>Valid Rows</span></div>
            <div><strong>{dataRows.length - valid.length}</strong><span>Issues Found</span></div>
          </div>
        </>
      )}

      {step === 4 && result && (
        <div className="empty-state">
          <FiCheckCircle style={{ color: 'var(--success)' }} />
          <h3>Import Summary</h3>
          <p>{result.inserted} lead(s) added to the database.</p>
          {result.skipped > 0 && (
            <p><FiAlertCircle /> {result.skipped} row(s) skipped for missing a name and email.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
