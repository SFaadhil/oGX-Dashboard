import { VP_KEY_AREAS, TEAM_LEADER_KEY_AREAS } from '../constants';

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

export function fullName(row = {}) {
  return (
    row.full_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    'Unnamed lead'
  );
}

export function formatDate(value, opts) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function yearLabel(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (/^\d$/.test(s)) return `Year ${s}`;
  return s;
}

export function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        /* fall through to comma split */
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [value];
}

export function isVP(manager) {
  if (!manager) return false;
  return VP_KEY_AREAS.some((k) => String(manager.key_area || '').toLowerCase() === k.toLowerCase());
}

export function isTeamLeader(manager) {
  if (!manager) return false;
  return TEAM_LEADER_KEY_AREAS.some(
    (k) => String(manager.key_area || '').toLowerCase() === k.toLowerCase()
  );
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function countBy(rows, pick) {
  const map = {};
  rows.forEach((row) => {
    const key = pick(row);
    if (key === null || key === undefined || key === '') return;
    if (Array.isArray(key)) {
      key.forEach((k) => { map[k] = (map[k] || 0) + 1; });
    } else {
      map[key] = (map[key] || 0) + 1;
    }
  });
  return map;
}

export function sortedEntries(map) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => escape(r[h])).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function parseCSV(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}
