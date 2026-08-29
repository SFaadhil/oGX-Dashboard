import { useState } from 'react';
import {
  FiBookOpen, FiUser, FiMail, FiPhone, FiCopy, FiCheck, FiGlobe, FiClock,
  FiCalendar, FiLinkedin, FiEye, FiDownload, FiMapPin, FiBriefcase, FiTag
} from 'react-icons/fi';
import { initials, fullName, formatDate, yearLabel, toArray } from '../lib/helpers';
import './CVCard.css';

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      className={`copy-btn${copied ? ' copied' : ''}`}
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(String(value));
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <FiCheck /> : <FiCopy />}
    </button>
  );
}

export default function CVCard({ lead, onView }) {
  const name = fullName(lead);
  const manager = lead.manager;
  const regions = toArray(lead.desired_regions);
  const countries = toArray(lead.desired_countries);
  const backgrounds = lead.backgrounds || [];
  const product = lead.product === 'GTa' || lead.product === 'GTe' ? lead.product : null;
  const startDate = formatDate(lead.start_date);
  const year = yearLabel(lead.year_of_studies);

  return (
    <article className="cv-card">
      <header className="cv-card-header">
        <div className="cv-avatar">{initials(name)}</div>
        <div className="cv-main-info">
          <h3>{name}</h3>
          <div className="cv-university">
            <FiBookOpen />
            <span>
              {lead.university || 'University not specified'}
              {year ? ` • ${year}` : ''}
            </span>
          </div>
        </div>
        <div className="product-badge-elegant">
          <span className={`product-badge product-${product || 'unknown'}`}>
            {product || 'N/A'}
          </span>
        </div>
      </header>

      <div className="cv-body">
        {manager && (
          <div className="manager-card">
            <div className="manager-card-header">
              <div className="manager-avatar"><FiUser /></div>
              <div className="manager-header-info">
                <div className="manager-badge">EP Manager</div>
                <div className="manager-name">
                  {[manager.first_name, manager.last_name].filter(Boolean).join(' ')}
                </div>
              </div>
            </div>
            <div className="manager-contact-grid">
              {manager.email && (
                <div className="manager-contact-item">
                  <div className="manager-contact-icon"><FiMail /></div>
                  <div className="manager-contact-content">
                    <span className="manager-contact-label">Email</span>
                    <div className="manager-contact-value">
                      <span className="contact-text">{manager.email}</span>
                      <CopyButton value={manager.email} />
                    </div>
                  </div>
                </div>
              )}
              {manager.phone_number && (
                <div className="manager-contact-item">
                  <div className="manager-contact-icon"><FiPhone /></div>
                  <div className="manager-contact-content">
                    <span className="manager-contact-label">Phone</span>
                    <div className="manager-contact-value">
                      <span className="contact-text">{manager.phone_number}</span>
                      <CopyButton value={manager.phone_number} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(lead.opportunity_title || lead.host_mc) && (
          <div className="cv-applied-to">
            <FiBriefcase />
            <span>
              {lead.opportunity_title || 'Opportunity'}
              {(lead.host_lc || lead.host_mc) && (
                <em>{[lead.host_lc, lead.host_mc].filter(Boolean).join(', ')}</em>
              )}
            </span>
          </div>
        )}

        {(regions.length > 0 || countries.length > 0 || startDate || lead.duration || lead.sub_product) && (
          <div className="cv-details">
            {lead.sub_product && (
              <div className="cv-detail">
                <FiTag className="detail-icon" />
                <span>{lead.sub_product}</span>
              </div>
            )}
            {regions.length > 0 && (
              <div className="cv-detail">
                <FiGlobe className="detail-icon" />
                <span>{regions.join(', ')}</span>
              </div>
            )}
            {countries.length > 0 && (
              <div className="cv-detail">
                <FiMapPin className="detail-icon" />
                <span>{countries.slice(0, 4).join(', ')}{countries.length > 4 ? ` +${countries.length - 4}` : ''}</span>
              </div>
            )}
            {startDate && (
              <div className="cv-detail">
                <FiCalendar className="detail-icon" />
                <span>Available: {startDate}</span>
              </div>
            )}
            {lead.duration && (
              <div className="cv-detail">
                <FiClock className="detail-icon" />
                <span>Duration: {lead.duration}</span>
              </div>
            )}
          </div>
        )}

        {backgrounds.length > 0 && (
          <div className="cv-backgrounds">
            {backgrounds.map((b) => (
              <span className="background-tag" key={b.id || b.name}>{b.name}</span>
            ))}
          </div>
        )}

        {lead.linkedin_url && (
          <a
            className="linkedin-link"
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FiLinkedin /> View LinkedIn Profile
          </a>
        )}

        <div className="cv-actions">
          <button
            className="btn btn-view"
            onClick={() => onView(lead)}
            disabled={!lead.cv_url}
            title={lead.cv_url ? 'Open the CV' : 'CV not available'}
          >
            <FiEye /> View CV
          </button>
          {lead.cv_url ? (
            <a className="btn btn-download" href={lead.cv_url} download target="_blank" rel="noopener noreferrer">
              <FiDownload /> Download
            </a>
          ) : (
            <span className="btn btn-download is-disabled"><FiDownload /> No CV</span>
          )}
        </div>
      </div>
    </article>
  );
}
