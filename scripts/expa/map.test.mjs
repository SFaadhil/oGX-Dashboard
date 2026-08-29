// Synthetic fixtures shaped like the EXPA GraphQL response.
// Run: node scripts/expa/map.test.mjs
import assert from 'node:assert/strict';
import { mapApplication, productFor, durationFor, yearOfStudiesFor } from './map.mjs';

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

const iso = (d) => new Date(d).toISOString();
const yearsAgo = (n) => iso(Date.now() - n * 365.25 * 24 * 3600 * 1000);
const yearsAhead = (n) => iso(Date.now() + n * 365.25 * 24 * 3600 * 1000);

function application(overrides = {}) {
  return {
    id: '7162600',
    status: 'open',
    current_status: 'open',
    created_at: iso('2026-08-28T06:00:00Z'),
    updated_at: iso('2026-08-28T06:10:00Z'),
    experience_start_date: iso('2026-10-01'),
    experience_end_date: iso('2027-02-01'),
    cv: null,
    slot: null,
    person: {
      id: '9001',
      full_name: 'Ananya Nair',
      first_name: 'Ananya',
      last_name: 'Nair',
      email: 'ananya@example.com',
      dob: '2004-04-12',
      gender: 'Female',
      linkedin_url: 'https://linkedin.com/in/example',
      cv_url: 'https://gis-api.aiesec.org/cv/9001.pdf',
      is_aiesecer: false,
      latest_graduation_date: null,
      contact_detail: { phone: '9810000000' },
      home_lc: { id: '2340', name: 'India National Office' },
      home_mc: { id: '1585', name: 'India' },
      latest_academic_level: { id: '1', name: 'Bachelor' },
      latest_academic: {
        id: '1', title: 'B.Tech', organisation_name: 'Delhi Technological University',
        start_date: yearsAgo(2), end_date: yearsAhead(2)
      },
      academic_experiences: [],
      latest_academic_experience_backgrounds: [{ id: '11', name: 'Computer sciences' }],
      managers: [{ id: '5001', full_name: 'Rohan Iyer', email: 'rohan@aiesec.in' }],
      person_profile: {
        selected_programmes: [8],
        duration_min: 6, duration_max: 12,
        earliest_start_date: null, latest_end_date: null,
        backgrounds: [{ id: '11', name: 'Computer sciences' }, { id: '12', name: 'Marketing' }]
      }
    },
    opportunity: {
      id: '4400',
      title: 'Software Engineering Intern',
      duration: 18,
      programme: { id: '8', short_name_display: 'GTa' },
      sub_product: { id: '3', name: 'Information Technology' },
      opportunity_duration_type: { id: '2', duration_type: 'long_term', duration_min: 24, duration_max: 78 },
      earliest_start_date: iso('2026-10-01'),
      latest_end_date: iso('2027-06-01'),
      home_lc: { id: '900', name: 'AIESEC in Warsaw' },
      home_mc: { id: '1600', name: 'Poland', country_code: 'PL' }
    },
    ...overrides
  };
}

console.log('product');
t('programme 8 -> GTa', () => assert.equal(productFor(application()), 'GTa'));
t('programme 9 -> GTe', () => assert.equal(
  productFor(application({ opportunity: { ...application().opportunity, programme: { id: '9', short_name_display: 'GTe' } } })),
  'GTe'
));
t('programme 7 (GV) -> null', () => assert.equal(
  productFor(application({ opportunity: { ...application().opportunity, programme: { id: '7', short_name_display: 'GV' } } })),
  null
));
t('unknown id falls back to the label', () => assert.equal(
  productFor(application({ opportunity: { ...application().opportunity, programme: { id: '99', short_name_display: 'GTe' } } })),
  'GTe'
));

console.log('duration');
t('long_term -> Long Term', () => assert.equal(durationFor(application()), 'Long Term'));
t('short_term -> Short Term', () => assert.equal(durationFor(application({
  opportunity: { ...application().opportunity, opportunity_duration_type: { duration_type: 'short_term' } }
})), 'Short Term'));
t('no duration_type: 8 weeks -> Short Term', () => assert.equal(durationFor(application({
  opportunity: { ...application().opportunity, opportunity_duration_type: null },
  experience_start_date: iso('2026-10-01'),
  experience_end_date: iso('2026-11-26')
})), 'Short Term'));
t('no duration_type: 20 weeks -> Mid Term', () => assert.equal(durationFor(application({
  opportunity: { ...application().opportunity, opportunity_duration_type: null },
  experience_start_date: iso('2026-10-01'),
  experience_end_date: iso('2027-02-18')
})), 'Mid Term'));
t('no dates at all -> null', () => assert.equal(durationFor(application({
  opportunity: { ...application().opportunity, opportunity_duration_type: null },
  experience_start_date: null, experience_end_date: null, slot: null
})), null));

console.log('year of studies');
t('started 2 years ago -> Year 3', () => assert.equal(yearOfStudiesFor(application().person), '3'));
t('graduated already -> Graduate', () => assert.equal(yearOfStudiesFor({
  ...application().person, latest_graduation_date: yearsAgo(1)
}), 'Graduate'));
t('course ended in the past -> Graduate', () => assert.equal(yearOfStudiesFor({
  ...application().person,
  latest_academic: { start_date: yearsAgo(5), end_date: yearsAgo(1) }
}), 'Graduate'));
t('no academic history -> null', () => assert.equal(yearOfStudiesFor({
  ...application().person, latest_graduation_date: null, latest_academic: null, academic_experiences: []
}), null));
t('falls back to academic_experiences', () => assert.equal(yearOfStudiesFor({
  ...application().person,
  latest_graduation_date: null,
  latest_academic: null,
  academic_experiences: [
    { start_date: yearsAgo(5), end_date: yearsAhead(3) },
    { start_date: yearsAgo(1), end_date: yearsAhead(3) }
  ]
}), '2'));

console.log('full mapping');
const m = mapApplication(application());
t('identifiers', () => {
  assert.equal(m.expaFields.expa_application_id, '7162600');
  assert.equal(m.expaFields.expa_person_id, '9001');
  assert.equal(m.expaFields.lead_id, '7162600');
});
t('person columns', () => {
  assert.equal(m.expaFields.full_name, 'Ananya Nair');
  assert.equal(m.expaFields.phone_number, '9810000000');
  assert.equal(m.expaFields.university, 'Delhi Technological University');
  assert.equal(m.expaFields.home_lc, 'India National Office');
  assert.equal(m.expaFields.date_of_birth, '2004-04-12');
});
t('opportunity columns', () => {
  assert.equal(m.expaFields.host_mc, 'Poland');
  assert.equal(m.expaFields.host_mc_country, 'PL');
  assert.equal(m.expaFields.sub_product, 'Information Technology');
  assert.equal(m.expaFields.programme_id, 8);
  assert.equal(m.expaFields.start_date, '2026-10-01');
});
t('backgrounds are deduped across both sources', () => {
  assert.deepEqual([...m.backgroundNames].sort(), ['Computer sciences', 'Marketing']);
});
t('cv falls back to person.cv_url', () => {
  assert.equal(m.cvUrl, 'https://gis-api.aiesec.org/cv/9001.pdf');
});
t('application cv wins over person cv', () => {
  const withCv = mapApplication(application({ cv: { id: '1', url: 'https://x/app.pdf' } }));
  assert.equal(withCv.cvUrl, 'https://x/app.pdf');
});
t('new-lead defaults keep the applicant out of the public pool', () => {
  assert.equal(m.defaults.show_in_cvpool, false);
  assert.equal(m.defaults.status, 'Not Contacted');
});
t('EXPA fields never include locally-managed columns', () => {
  ['manager_id', 'status', 'show_in_cvpool', 'feedback_status', 'manager_feedback', 'assigned_on_expa']
    .forEach((k) => assert.ok(!(k in m.expaFields), `${k} must not be EXPA-owned`));
});
t('name split when only full_name is present', () => {
  const only = mapApplication(application({
    person: { ...application().person, first_name: null, last_name: null, full_name: 'Kabir Singh Verma' }
  }));
  assert.equal(only.expaFields.first_name, 'Kabir');
  assert.equal(only.expaFields.last_name, 'Singh Verma');
});

console.log(`\n${passed} assertion group(s) passed`);
