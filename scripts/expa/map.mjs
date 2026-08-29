// EXPA application -> `leads` row.
//
// Everything here is EXPA-owned. Locally-managed columns (manager_id, status,
// show_in_cvpool, feedback_status, manager_feedback, assigned_on_expa) are
// deliberately absent so an hourly re-sync can never trample the team's work.

import { PROGRAMME_PRODUCT } from './client.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function productFor(application) {
  const id = Number(application?.opportunity?.programme?.id);
  if (PROGRAMME_PRODUCT[id]) return PROGRAMME_PRODUCT[id];
  // Fall back to the label EXPA renders, in case programme ids ever move.
  const label = application?.opportunity?.programme?.short_name_display;
  if (label === 'GTa' || label === 'GTe') return label;
  return null;
}

export function durationFor(application) {
  const raw = application?.opportunity?.opportunity_duration_type?.duration_type;
  if (raw) {
    const s = String(raw).toLowerCase();
    if (s.includes('short')) return 'Short Term';
    if (s.includes('mid') || s.includes('medium')) return 'Mid Term';
    if (s.includes('long')) return 'Long Term';
  }

  // Otherwise infer from the experience window: <=12 weeks short, <=26 mid.
  const start = application?.experience_start_date || application?.slot?.start_date;
  const end = application?.experience_end_date || application?.slot?.end_date;
  if (start && end) {
    const weeks = (new Date(end) - new Date(start)) / WEEK_MS;
    if (Number.isFinite(weeks) && weeks > 0) {
      if (weeks <= 12) return 'Short Term';
      if (weeks <= 26) return 'Mid Term';
      return 'Long Term';
    }
  }
  return null;
}

export function yearOfStudiesFor(person) {
  const graduation = person?.latest_graduation_date;
  if (graduation) {
    const grad = new Date(graduation);
    if (!Number.isNaN(grad.getTime()) && grad.getTime() < Date.now()) return 'Graduate';
  }

  const academic = person?.latest_academic
    || (person?.academic_experiences || [])
      .slice()
      .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0))[0];

  if (academic?.end_date) {
    const end = new Date(academic.end_date);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return 'Graduate';
  }

  if (academic?.start_date) {
    const start = new Date(academic.start_date);
    if (!Number.isNaN(start.getTime())) {
      const years = Math.floor((Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000)) + 1;
      if (years >= 1 && years <= 5) return String(years);
      if (years > 5) return 'Graduate';
    }
  }
  return null;
}

export function universityFor(person) {
  return (
    person?.latest_academic?.organisation_name
    || (person?.academic_experiences || []).find((a) => a.organisation_name)?.organisation_name
    || null
  );
}

export function cvUrlFor(application) {
  return application?.cv?.url || application?.person?.cv_url || null;
}

export function backgroundNamesFor(person) {
  const names = new Set();
  (person?.person_profile?.backgrounds || []).forEach((b) => b?.name && names.add(b.name.trim()));
  (person?.latest_academic_experience_backgrounds || []).forEach((b) => b?.name && names.add(b.name.trim()));
  return [...names].filter(Boolean);
}

function dateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Columns EXPA owns. Written on insert and refreshed on every later run. */
export function expaFieldsFor(application) {
  const person = application.person || {};
  const opportunity = application.opportunity || {};

  return {
    expa_application_id: String(application.id),
    expa_person_id: person.id ? String(person.id) : null,
    expa_status: application.current_status || application.status || null,
    lead_id: String(application.id),
    first_name: person.first_name || (person.full_name || '').split(/\s+/)[0] || null,
    last_name: person.last_name || (person.full_name || '').split(/\s+/).slice(1).join(' ') || null,
    full_name: person.full_name || null,
    email: person.email || null,
    phone_number: person.contact_detail?.phone || null,
    gender: person.gender || null,
    date_of_birth: dateOnly(person.dob),
    linkedin_url: person.linkedin_url || null,
    university: universityFor(person),
    home_lc: person.home_lc?.name || null,
    is_aiesecer: Boolean(person.is_aiesecer),
    product: productFor(application),
    programme_id: opportunity.programme?.id ? Number(opportunity.programme.id) : null,
    sub_product: opportunity.sub_product?.name || null,
    year_of_studies: yearOfStudiesFor(person),
    duration: durationFor(application),
    start_date: dateOnly(application.experience_start_date || application.slot?.start_date),
    experience_end_date: dateOnly(application.experience_end_date || application.slot?.end_date),
    opportunity_id: opportunity.id ? String(opportunity.id) : null,
    opportunity_title: opportunity.title || null,
    host_lc: opportunity.home_lc?.name || null,
    host_mc: opportunity.home_mc?.name || null,
    host_mc_country: opportunity.home_mc?.country_code || null,
    applied_at: application.created_at || null,
    source: 'expa',
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/** Extra columns set only when the row is first created. */
export function defaultsForNewLead(application) {
  return {
    status: 'Not Contacted',
    feedback_status: 'pending',
    assigned_on_expa: false,
    // Never publish an applicant to the public pool automatically - someone on
    // the team opts each lead in from the dashboard.
    show_in_cvpool: false,
    desired_regions: [],
    desired_countries: [],
    created_at: application.created_at || new Date().toISOString()
  };
}

export function mapApplication(application) {
  return {
    expaFields: expaFieldsFor(application),
    defaults: defaultsForNewLead(application),
    backgroundNames: backgroundNamesFor(application.person),
    cvUrl: cvUrlFor(application),
    managers: (application.person?.managers || []).map((m) => ({
      expa_id: String(m.id),
      full_name: m.full_name,
      email: m.email
    }))
  };
}
