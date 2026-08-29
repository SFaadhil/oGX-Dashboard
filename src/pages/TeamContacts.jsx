import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiX, FiMail, FiPhone, FiUsers, FiInbox, FiArrowRight } from 'react-icons/fi';
import { fetchLeads, fetchManagers } from '../lib/leadsApi';
import { initials } from '../lib/helpers';
import { KEY_AREAS, OGT_TEAMS } from '../constants';

export default function TeamContacts() {
  const [managers, setManagers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [team, setTeam] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { rows } = await fetchManagers();
      const { rows: leads } = await fetchLeads({ withBackgrounds: false, withDocuments: false });
      if (cancelled) return;
      const map = {};
      leads.forEach((l) => { if (l.manager_id) map[l.manager_id] = (map[l.manager_id] || 0) + 1; });
      setManagers(rows);
      setCounts(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return managers.filter((m) => {
      if (role && m.key_area !== role) return false;
      if (team && m.ogt !== team) return false;
      if (q) {
        const hay = [m.first_name, m.last_name, m.email, m.key_area].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [managers, search, role, team]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Team Contacts</h1>
          <p className="page-subtitle">Everyone in the oGX function and how to reach them.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, email, or key area"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}><FiX /></button>}
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All Roles</option>
          {KEY_AREAS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">All oGT</option>
          {OGT_TEAMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading team contacts...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiInbox /><h3>No team members found</h3>
          <p>No team members found matching your criteria.</p>
        </div>
      ) : (
        <div className="member-grid">
          {filtered.map((m) => {
            const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
            return (
              <div className="member-card" key={m.id}>
                <div className="member-head">
                  <div className="member-avatar">
                    {m.profile_picture
                      ? <img src={m.profile_picture} alt={name} />
                      : initials(name)}
                  </div>
                  <div>
                    <strong>{name}</strong>
                    <span>{m.key_area || 'Team Member'}</span>
                  </div>
                </div>
                <div className="member-meta">
                  {m.ogt && <span className="chip on">{m.ogt}</span>}
                  <span className="chip">{counts[m.id] || 0} leads</span>
                </div>
                <div className="member-actions">
                  {m.email && (
                    <a className="btn btn-sm btn-ghost" href={`mailto:${m.email}`}><FiMail /> Email</a>
                  )}
                  {m.phone_number && (
                    <a className="btn btn-sm btn-ghost" href={`tel:${m.phone_number}`}><FiPhone /> Call</a>
                  )}
                  <Link className="btn btn-sm btn-primary" to={`/dashboard/team-leads/${m.id}`}>
                    <FiUsers /> Leads <FiArrowRight />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
