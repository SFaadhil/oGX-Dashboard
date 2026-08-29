import { useEffect, useMemo, useRef, useState } from 'react';
import './MultiSelect.css';

/**
 * Searchable multi-select used by every filter panel in the app.
 * `options` accepts strings or { value, label } objects.
 */
export default function MultiSelect({
  options = [],
  selected = [],
  onChange,
  placeholder = 'Select...',
  emptyText = 'No options found',
  searchable = true
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const normalised = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalised;
    return normalised.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalised, query]);

  const toggle = (value) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const buttonLabel = () => {
    if (!selected.length) return placeholder;
    if (selected.length === 1) {
      const hit = normalised.find((o) => o.value === selected[0]);
      return hit ? hit.label : selected[0];
    }
    return `${selected.length} selected`;
  };

  return (
    <div className="multi-select-container" ref={ref}>
      <button
        type="button"
        className={`multi-select-button${selected.length ? ' has-value' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {buttonLabel()}
      </button>

      {open && (
        <div className="multi-select-dropdown">
          {searchable && (
            <input
              className="multi-select-search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}

          {selected.length > 0 && (
            <button type="button" className="multi-select-clear" onClick={() => onChange([])}>
              Clear selection
            </button>
          )}

          <div className="multi-select-options">
            {filtered.length === 0 && <div className="multi-select-empty">{emptyText}</div>}
            {filtered.map((o) => (
              <label key={o.value} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
