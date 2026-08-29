import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiSearch, FiFilter, FiMoon, FiSun, FiBarChart2, FiX, FiGlobe, FiMapPin,
  FiClock, FiUser, FiTag, FiInbox, FiLock, FiRefreshCw, FiExternalLink
} from 'react-icons/fi';
import MultiSelect from '../components/MultiSelect';
import CVCard from '../components/CVCard';
import PoolStats from '../components/PoolStats';
import Modal from '../components/Modal';
import { useTheme } from '../context/ThemeContext';
import { supabase, isSupabaseConfigured, publicFileUrl } from '../lib/supabaseClient';
import { PRODUCTS, YEARS, REGIONS, COUNTRIES, DURATIONS } from '../constants';
import { fullName, toArray, yearLabel } from '../lib/helpers';
import './CVPool.css';

const PAGE_SIZE = 24;

const EMPTY_FILTERS = {
  product: [],
  year: [],
  region: [],
  country: [],
  duration: [],
  manager: [],
  background: []
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'university', label: 'University (A-Z)' }
];

export default function CVPool() {
  const { theme, toggleTheme } = useTheme();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [poolOpen, setPoolOpen] = useState(true);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState('recent');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [preview, setPreview] = useState(null);

  const sentinelRef = useRef(null);

  /* ---------------------------------------------------------------- load */
  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setLoadError('Supabase is not configured yet. Add your project URL and anon key to .env.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      // The pool can be switched off centrally from app_settings.
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cv_pool_open')
        .maybeSingle();
      if (setting && String(setting.value) === 'false') {
        setPoolOpen(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, lead_id, first_name, last_name, full_name, email, phone_number, university,
          product, sub_product, year_of_studies, linkedin_url, desired_regions, desired_countries,
          duration, start_date, created_at, show_in_cvpool,
          opportunity_title, host_lc, host_mc, host_mc_country,
          manager:manager_id (id, first_name, last_name, email, phone_number, key_area)
        `)
        .eq('show_in_cvpool', true)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = data || [];
      const ids = rows.map((r) => r.id);

      // Backgrounds + CV documents come from join tables.
      const [bgRes, docRes] = await Promise.all([
        ids.length
          ? supabase.from('lead_backgrounds').select('lead_id, backgrounds(id, name)').in('lead_id', ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase
              .from('lead_documents')
              .select('lead_id, file_url, doc_type, uploaded_at')
              .in('lead_id', ids)
              .order('uploaded_at', { ascending: false })
          : Promise.resolve({ data: [] })
      ]);

      const bgMap = {};
      (bgRes.data || []).forEach((row) => {
        if (!row.backgrounds) return;
        (bgMap[row.lead_id] = bgMap[row.lead_id] || []).push(row.backgrounds);
      });

      const cvMap = {};
      (docRes.data || []).forEach((row) => {
        const isCV = !row.doc_type || String(row.doc_type).toLowerCase().includes('cv');
        if (isCV && !cvMap[row.lead_id]) cvMap[row.lead_id] = publicFileUrl(row.file_url);
      });

      setLeads(
        rows.map((r) => ({
          ...r,
          backgrounds: bgMap[r.id] || [],
          cv_url: cvMap[r.id] || null
        }))
      );
    } catch (err) {
      setLoadError(err.message || 'Could not load the CV pool.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ------------------------------------------------------------- options */
  const managerOptions = useMemo(() => {
    const map = new Map();
    leads.forEach((l) => {
      if (!l.manager) return;
      const name = [l.manager.first_name, l.manager.last_name].filter(Boolean).join(' ');
      if (name) map.set(name, name);
    });
    return [...map.keys()].sort().map((v) => ({ value: v, label: v }));
  }, [leads]);

  const backgroundOptions = useMemo(() => {
    const set = new Set();
    leads.forEach((l) => (l.backgrounds || []).forEach((b) => b?.name && set.add(b.name)));
    return [...set].sort().map((v) => ({ value: v, label: v }));
  }, [leads]);

  /* ------------------------------------------------------------ filtering */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = leads.filter((l) => {
      if (q) {
        const haystack = [
          fullName(l), l.email, l.university, l.lead_id, l.phone_number,
          l.manager && [l.manager.first_name, l.manager.last_name].join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.product.length && !filters.product.includes(l.product)) return false;
      if (filters.year.length) {
        const y = l.year_of_studies === null || l.year_of_studies === undefined
          ? null : String(l.year_of_studies);
        if (!y || !filters.year.includes(y)) return false;
      }
      if (filters.duration.length && !filters.duration.includes(l.duration)) return false;
      if (filters.region.length) {
        const regions = toArray(l.desired_regions);
        if (!filters.region.some((r) => regions.includes(r))) return false;
      }
      if (filters.country.length) {
        const countries = toArray(l.desired_countries);
        if (!filters.country.some((c) => countries.includes(c))) return false;
      }
      if (filters.manager.length) {
        const name = l.manager
          ? [l.manager.first_name, l.manager.last_name].filter(Boolean).join(' ')
          : '';
        if (!filters.manager.includes(name)) return false;
      }
      if (filters.background.length) {
        const names = (l.backgrounds || []).map((b) => b.name);
        if (!filters.background.some((b) => names.includes(b))) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'name') return fullName(a).localeCompare(fullName(b));
      if (sortBy === 'university') return (a.university || '').localeCompare(b.university || '');
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });

    return rows;
  }, [leads, search, filters, sortBy]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [search, filters, sortBy]);

  /* ------------------------------------------------------ infinite scroll */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
    }, { rootMargin: '400px' });
    io.observe(node);
    return () => io.disconnect();
  }, [filtered.length]);

  /* ----------------------------------------------------------- filter ops */
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearAll = () => { setFilters(EMPTY_FILTERS); setSearch(''); };

  const activeChips = useMemo(() => {
    const chips = [];
    Object.entries(filters).forEach(([key, values]) => {
      values.forEach((v) => chips.push({ key, value: v }));
    });
    return chips;
  }, [filters]);

  const removeChip = (chip) =>
    setFilter(chip.key, filters[chip.key].filter((v) => v !== chip.value));

  /* -------------------------------------------------------------- render */
  if (!poolOpen) {
    return (
      <div className="cv-pool-closed">
        <div className="closed-card">
          <FiLock />
          <h2>CV Pool is Currently Closed</h2>
          <p>The CV pool is temporarily unavailable. Contact your LCVP oGX if you need anything.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cv-pool">
      <header className="cv-header">
        <div className="header-logo-container">
          <img className="header-logo" src="/aiesec-india.svg" alt="AIESEC in India" />
        </div>
        <h1 className="cv-title">oGX INDIA <span>Talent Hub</span></h1>
        <div className="header-actions">
          <button className="pill-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button className="pill-btn" onClick={() => setShowStats((s) => !s)}>
            <FiBarChart2 />
            <span>{showStats ? 'Hide Stats' : 'Show Stats'}</span>
          </button>
        </div>
      </header>

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading CV pool...</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="empty-state">
          <FiInbox />
          <h3>Could not load the CV pool</h3>
          <p>{loadError}</p>
          <button className="btn btn-primary" onClick={load}><FiRefreshCw /> Try again</button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {showStats && <PoolStats leads={filtered} />}

          <div className="cv-controls">
            <div className="search-wrapper">
              <FiSearch className="search-icon" />
              <input
                className="search-input"
                type="text"
                placeholder="Search by name, email, EP ID, or university..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <FiX />
                </button>
              )}
            </div>
            <div className="controls-group">
              <button
                className={`filter-toggle${showFilters ? ' active' : ''}`}
                onClick={() => setShowFilters((s) => !s)}
              >
                <FiFilter />
                <span>Filters</span>
                {activeChips.length > 0 && <em className="filter-count">{activeChips.length}</em>}
              </button>
              <div className="sort-selector">
                <label>Sort by:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div className="filters-header">
                <h3>Filter CVs</h3>
                {activeChips.length > 0 && (
                  <button className="link-btn" onClick={clearAll}>Clear All</button>
                )}
              </div>
              <div className="filters-grid">
                <div className="filter-group">
                  <label><FiTag /> Product</label>
                  <MultiSelect
                    options={PRODUCTS}
                    selected={filters.product}
                    onChange={(v) => setFilter('product', v)}
                    placeholder="Select products..."
                    searchable={false}
                  />
                </div>
                <div className="filter-group">
                  <label><FiUser /> Year of Study</label>
                  <MultiSelect
                    options={YEARS}
                    selected={filters.year}
                    onChange={(v) => setFilter('year', v)}
                    placeholder="Select years..."
                    searchable={false}
                  />
                </div>
                <div className="filter-group">
                  <label><FiGlobe /> Region</label>
                  <MultiSelect
                    options={REGIONS}
                    selected={filters.region}
                    onChange={(v) => setFilter('region', v)}
                    placeholder="Select regions..."
                    emptyText="No regions found"
                  />
                </div>
                <div className="filter-group">
                  <label><FiMapPin /> Country</label>
                  <MultiSelect
                    options={COUNTRIES}
                    selected={filters.country}
                    onChange={(v) => setFilter('country', v)}
                    placeholder="Select countries..."
                    emptyText="No countries found"
                  />
                </div>
                <div className="filter-group">
                  <label><FiClock /> Duration</label>
                  <MultiSelect
                    options={DURATIONS}
                    selected={filters.duration}
                    onChange={(v) => setFilter('duration', v)}
                    placeholder="Select durations..."
                    searchable={false}
                  />
                </div>
                <div className="filter-group">
                  <label><FiUser /> EP Manager</label>
                  <MultiSelect
                    options={managerOptions}
                    selected={filters.manager}
                    onChange={(v) => setFilter('manager', v)}
                    placeholder="Select EP managers..."
                    emptyText="No EP managers with assigned CVs found"
                  />
                </div>
                <div className="filter-group full-width">
                  <label><FiTag /> Backgrounds</label>
                  <MultiSelect
                    options={backgroundOptions}
                    selected={filters.background}
                    onChange={(v) => setFilter('background', v)}
                    placeholder="Select backgrounds..."
                    emptyText="No backgrounds found"
                  />
                </div>
              </div>
            </div>
          )}

          {activeChips.length > 0 && (
            <div className="active-filters">
              {activeChips.map((chip) => (
                <button
                  className="filter-chip"
                  key={`${chip.key}-${chip.value}`}
                  onClick={() => removeChip(chip)}
                >
                  {chip.value} <FiX />
                </button>
              ))}
              <button className="filter-chip clear" onClick={clearAll}>Clear all</button>
            </div>
          )}

          <div className="results-info">
            Showing <strong>{Math.min(visible, filtered.length)}</strong> of{' '}
            <strong>{filtered.length}</strong> CVs
            {filtered.length !== leads.length && <span> (filtered from {leads.length})</span>}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <FiInbox />
              <h3>No CVs Found</h3>
              <p>Try adjusting your filters to see more results</p>
              <button className="btn btn-primary" onClick={clearAll}>Clear Filters</button>
            </div>
          ) : (
            <>
              <div className="cv-grid">
                {filtered.slice(0, visible).map((lead) => (
                  <CVCard key={lead.id} lead={lead} onView={setPreview} />
                ))}
              </div>
              <div ref={sentinelRef} className="load-more-sentinel" />
            </>
          )}
        </>
      )}

      <Modal
        open={Boolean(preview)}
        title={preview ? `${fullName(preview)} - Curriculum Vitae` : ''}
        onClose={() => setPreview(null)}
        width={960}
        footer={
          preview?.cv_url && (
            <a className="btn btn-primary" href={preview.cv_url} target="_blank" rel="noopener noreferrer">
              <FiExternalLink /> Open in new tab
            </a>
          )
        }
      >
        {preview?.cv_url ? (
          <iframe className="cv-frame" src={preview.cv_url} title="Curriculum Vitae" />
        ) : (
          <p className="cv-frame-empty">CV not available</p>
        )}
        {preview && (
          <div className="preview-meta">
            <span>{preview.university || 'University not specified'}</span>
            {yearLabel(preview.year_of_studies) && <span>{yearLabel(preview.year_of_studies)}</span>}
            {preview.product && <span>{preview.product}</span>}
          </div>
        )}
      </Modal>

      <footer className="cv-footer">
        AIESEC in India - oGX Talent Hub
      </footer>
    </div>
  );
}
