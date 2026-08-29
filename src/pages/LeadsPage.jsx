import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSearch, FiFilter, FiX, FiDownload, FiUpload, FiColumns, FiEye, FiEdit2,
  FiRefreshCw, FiAlertCircle, FiCheckSquare, FiSquare, FiInbox, FiExternalLink, FiLock
} from 'react-icons/fi';
import MultiSelect from '../components/MultiSelect';
import Modal from '../components/Modal';
import LeadEditor from '../components/LeadEditor';
import CSVImport from '../components/CSVImport';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fetchLeads, fetchManagers, logAction } from '../lib/leadsApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  PRODUCTS, YEARS, REGIONS, COUNTRIES, DURATIONS, LEAD_STATUSES, STATUS_TONE, DATE_RANGES
} from '../constants';
import { fullName, formatDate, toArray, initials, downloadCSV, yearLabel } from '../lib/helpers';

const ALL_COLUMNS = [
  { key: 'name', label: 'Name', always: true },
  { key: 'lead_id', label: 'EP ID' },
  { key: 'product', label: 'Product' },
  { key: 'status', label: 'Status' },
  { key: 'manager', label: 'Manager' },
  { key: 'university', label: 'University' },
  { key: 'year', label: 'Year' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'duration', label: 'Duration' },
  { key: 'regions', label: 'Desired Regions' },
  { key: 'expa', label: 'EXPA' },
  { key: 'pool', label: 'CV Pool' },
  { key: 'created', label: 'Created' }
];

const DEFAULT_COLUMNS = ['name', 'product', 'status', 'manager', 'university', 'expa', 'created'];
const EMPTY_FILTERS = { product: [], year: [], status: [], region: [], country: [], duration: [], manager: [] };

export default function LeadsPage({ scope = 'mine' }) {
  const { manager, isVP } = useAuth();
  const toast = useToast();

  const [leads, setLeads] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [dateRange, setDateRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColumns, setShowColumns] = useState(false);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);

  const denied = scope === 'all' && !isVP;

  const load = useCallback(async () => {
    if (denied) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { rows, error: err } = await fetchLeads({
      filter: (q) => (scope === 'all' ? q : q.eq('manager_id', manager?.id))
    });
    if (err) setError(err);
    setLeads(rows);
    const { rows: mgrs } = await fetchManagers('id, first_name, last_name, email, key_area, ogt');
    setManagers(mgrs);
    setLoading(false);
  }, [scope, manager?.id, denied]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ogx_india_lead_columns');
      if (saved) setColumns(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const saveColumns = (next) => {
    setColumns(next);
    try { localStorage.setItem('ogx_india_lead_columns', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const managerOptions = useMemo(
    () => managers.map((m) => ({
      value: m.id,
      label: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email
    })),
    [managers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === 'all' ? null : Date.now() - Number(dateRange) * 86400000;

    return leads.filter((l) => {
      if (q) {
        const hay = [fullName(l), l.email, l.university, l.lead_id, l.phone_number]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.product.length && !filters.product.includes(l.product)) return false;
      if (filters.status.length && !filters.status.includes(l.status || 'Not Contacted')) return false;
      if (filters.duration.length && !filters.duration.includes(l.duration)) return false;
      if (filters.manager.length && !filters.manager.includes(l.manager_id)) return false;
      if (filters.year.length) {
        const y = l.year_of_studies == null ? null : String(l.year_of_studies);
        if (!y || !filters.year.includes(y)) return false;
      }
      if (filters.region.length) {
        const regions = toArray(l.desired_regions);
        if (!filters.region.some((r) => regions.includes(r))) return false;
      }
      if (filters.country.length) {
        const countries = toArray(l.desired_countries);
        if (!filters.country.some((c) => countries.includes(c))) return false;
      }
      if (cutoff && new Date(l.created_at || 0).getTime() < cutoff) return false;
      return true;
    });
  }, [leads, search, filters, dateRange]);

  const activeCount = useMemo(
    () => Object.values(filters).reduce((n, arr) => n + arr.length, 0) + (dateRange !== 'all' ? 1 : 0),
    [filters, dateRange]
  );

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearAll = () => { setFilters(EMPTY_FILTERS); setDateRange('all'); setSearch(''); };

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleSelectAll = () =>
    setSelected((s) => (s.length === filtered.length ? [] : filtered.map((l) => l.id)));

  const bulkUpdate = async (patch, label) => {
    if (!selected.length || !isSupabaseConfigured) return;
    const { error: err } = await supabase.from('leads').update(patch).in('id', selected);
    if (err) { toast.error(err.message); return; }
    await logAction(manager?.id, label, { ids: selected, patch });
    toast.success(`${selected.length} lead(s) updated.`);
    setSelected([]);
    load();
  };

  const exportCSV = () => {
    if (!filtered.length) { toast.info('Nothing to export.'); return; }
    downloadCSV(
      `ogx-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((l) => ({
        ep_id: l.lead_id || '',
        name: fullName(l),
        email: l.email || '',
        phone: l.phone_number || '',
        product: l.product || '',
        status: l.status || '',
        university: l.university || '',
        year_of_studies: l.year_of_studies || '',
        duration: l.duration || '',
        desired_regions: toArray(l.desired_regions).join(' | '),
        desired_countries: toArray(l.desired_countries).join(' | '),
        backgrounds: (l.backgrounds || []).map((b) => b.name).join(' | '),
        manager: l.manager ? [l.manager.first_name, l.manager.last_name].join(' ') : '',
        assigned_on_expa: l.assigned_on_expa ? 'yes' : 'no',
        show_in_cvpool: l.show_in_cvpool ? 'yes' : 'no',
        created_at: l.created_at || ''
      }))
    );
  };

  if (denied) {
    return (
      <div className="access-denied">
        <FiLock />
        <h3>Access Denied</h3>
        <p>Only VPs can view organisation leads.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{scope === 'all' ? 'All Leads' : 'My Leads'}</h1>
          <p className="page-subtitle">
            {scope === 'all'
              ? 'Every lead in the entity, across both oGX teams.'
              : 'Leads currently assigned to you.'}
          </p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={load}><FiRefreshCw /> Refresh</button>
          <button className="btn btn-ghost" onClick={() => setShowColumns(true)}><FiColumns /> Columns</button>
          <button className="btn btn-ghost" onClick={exportCSV}><FiDownload /> Export CSV</button>
          {isVP && (
            <button className="btn btn-primary" onClick={() => setImporting(true)}>
              <FiUpload /> Import CSV
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, email, EP ID, or university..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}><FiX /></button>
          )}
        </div>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button
          className={`filter-toggle${showFilters ? ' active' : ''}`}
          onClick={() => setShowFilters((s) => !s)}
        >
          <FiFilter /> <span>Filters</span>
          {activeCount > 0 && <em className="filter-count">{activeCount}</em>}
        </button>
        {activeCount > 0 && <button className="link-btn" onClick={clearAll}>Clear All</button>}
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-header">
            <h3>Filter Leads</h3>
            {activeCount > 0 && <button className="link-btn" onClick={clearAll}>Clear All</button>}
          </div>
          <div className="filters-grid">
            <div className="filter-group">
              <label>Product</label>
              <MultiSelect options={PRODUCTS} selected={filters.product}
                onChange={(v) => setFilter('product', v)} placeholder="Select product" searchable={false} />
            </div>
            <div className="filter-group">
              <label>Status</label>
              <MultiSelect options={LEAD_STATUSES} selected={filters.status}
                onChange={(v) => setFilter('status', v)} placeholder="All Status" searchable={false} />
            </div>
            <div className="filter-group">
              <label>Year of Studies</label>
              <MultiSelect options={YEARS} selected={filters.year}
                onChange={(v) => setFilter('year', v)} placeholder="Select year" searchable={false} />
            </div>
            <div className="filter-group">
              <label>Duration</label>
              <MultiSelect options={DURATIONS} selected={filters.duration}
                onChange={(v) => setFilter('duration', v)} placeholder="Select duration" searchable={false} />
            </div>
            <div className="filter-group">
              <label>Desired Regions</label>
              <MultiSelect options={REGIONS} selected={filters.region}
                onChange={(v) => setFilter('region', v)} placeholder="Select regions" />
            </div>
            <div className="filter-group">
              <label>Desired Countries</label>
              <MultiSelect options={COUNTRIES} selected={filters.country}
                onChange={(v) => setFilter('country', v)} placeholder="Select countries" />
            </div>
            {scope === 'all' && (
              <div className="filter-group full-width">
                <label>Manager</label>
                <MultiSelect options={managerOptions} selected={filters.manager}
                  onChange={(v) => setFilter('manager', v)} placeholder="All Managers" />
              </div>
            )}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="toolbar" style={{ borderColor: 'var(--primary)' }}>
          <span className="select-count">{selected.length} selected</span>
          <button className="btn btn-sm btn-ghost" onClick={() => bulkUpdate({ show_in_cvpool: true }, 'cvpool_show')}>
            Add to CV Pool
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => bulkUpdate({ show_in_cvpool: false }, 'cvpool_hide')}>
            Remove from CV Pool
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => bulkUpdate({ assigned_on_expa: true }, 'expa_assigned')}>
            Mark assigned on EXPA
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected([])}><FiX /> Clear</button>
        </div>
      )}

      <div className="results-info">
        Showing <strong>{filtered.length}</strong> of <strong>{leads.length}</strong> leads
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading leads...</p></div>
      ) : error ? (
        <div className="empty-state">
          <FiAlertCircle /><h3>Could not load leads</h3><p>{error}</p>
          <button className="btn btn-primary" onClick={load}><FiRefreshCw /> Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiInbox /><h3>No leads found</h3>
          <p>No leads match your current filters.</p>
          <button className="btn btn-primary" onClick={clearAll}>Clear Filters</button>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <button className="row-btn" onClick={toggleSelectAll} aria-label="Select all">
                      {selected.length === filtered.length ? <FiCheckSquare /> : <FiSquare />}
                    </button>
                  </th>
                  {ALL_COLUMNS.filter((c) => c.always || columns.includes(c.key)).map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const on = (k) => ALL_COLUMNS.find((c) => c.key === k)?.always || columns.includes(k);
                  return (
                    <tr key={l.id}>
                      <td>
                        <button className="row-btn" onClick={() => toggleSelect(l.id)} aria-label="Select row">
                          {selected.includes(l.id) ? <FiCheckSquare /> : <FiSquare />}
                        </button>
                      </td>
                      {on('name') && (
                        <td>
                          <Link className="lead-name-cell" to={`/lead/${l.id}`}>
                            <span className="mini-avatar">{initials(fullName(l))}</span>
                            <span><strong>{fullName(l)}</strong><span>{l.email || ''}</span></span>
                          </Link>
                        </td>
                      )}
                      {on('lead_id') && <td>{l.lead_id || '-'}</td>}
                      {on('product') && (
                        <td>
                          {l.product
                            ? <span className={`product-badge product-${l.product}`}>{l.product}</span>
                            : '-'}
                        </td>
                      )}
                      {on('status') && (
                        <td>
                          <span className={`badge ${STATUS_TONE[l.status] || 'badge-neutral'}`}>
                            {l.status || 'Not Contacted'}
                          </span>
                        </td>
                      )}
                      {on('manager') && (
                        <td>{l.manager ? [l.manager.first_name, l.manager.last_name].filter(Boolean).join(' ') : 'Unassigned'}</td>
                      )}
                      {on('university') && <td>{l.university || '-'}</td>}
                      {on('year') && <td>{yearLabel(l.year_of_studies) || '-'}</td>}
                      {on('email') && <td>{l.email || '-'}</td>}
                      {on('phone') && <td>{l.phone_number || '-'}</td>}
                      {on('duration') && <td>{l.duration || '-'}</td>}
                      {on('regions') && <td>{toArray(l.desired_regions).join(', ') || '-'}</td>}
                      {on('expa') && (
                        <td>
                          <span className={`badge ${l.assigned_on_expa ? 'badge-success' : 'badge-warning'}`}>
                            {l.assigned_on_expa ? 'Assigned' : 'Pending'}
                          </span>
                        </td>
                      )}
                      {on('pool') && (
                        <td>
                          <span className={`badge ${l.show_in_cvpool ? 'badge-success' : 'badge-neutral'}`}>
                            {l.show_in_cvpool ? 'Live' : 'Hidden'}
                          </span>
                        </td>
                      )}
                      {on('created') && <td>{formatDate(l.created_at) || '-'}</td>}
                      <td>
                        <div className="row-actions">
                          <Link className="row-btn" to={`/lead/${l.id}`} title="View"><FiEye /></Link>
                          <button className="row-btn" onClick={() => setEditing(l)} title="Edit"><FiEdit2 /></button>
                          {l.cv_url && (
                            <a className="row-btn" href={l.cv_url} target="_blank" rel="noopener noreferrer" title="CV">
                              <FiExternalLink />
                            </a>
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

      <Modal open={showColumns} title="Customize Columns" onClose={() => setShowColumns(false)} width={480}>
        <div className="chip-row">
          {ALL_COLUMNS.map((c) => (
            <button
              key={c.key}
              className={`chip${c.always || columns.includes(c.key) ? ' on' : ''}`}
              disabled={c.always}
              onClick={() =>
                saveColumns(columns.includes(c.key) ? columns.filter((k) => k !== c.key) : [...columns, c.key])}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Modal>

      <LeadEditor
        lead={editing}
        managers={managers}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />

      <CSVImport
        open={importing}
        managers={managers}
        onClose={() => setImporting(false)}
        onImported={() => { setImporting(false); load(); }}
      />
    </>
  );
}
