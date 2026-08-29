import { useEffect, useState } from 'react';
import { FiSave } from 'react-icons/fi';
import Modal from './Modal';
import MultiSelect from './MultiSelect';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchBackgrounds, setLeadBackgrounds, logAction } from '../lib/leadsApi';
import { PRODUCTS, YEARS, REGIONS, COUNTRIES, DURATIONS, LEAD_STATUSES, GENDERS } from '../constants';
import { toArray } from '../lib/helpers';

const BLANK = {
  first_name: '', last_name: '', email: '', phone_number: '', lead_id: '', university: '',
  product: '', year_of_studies: '', duration: '', status: 'Not Contacted', linkedin_url: '',
  gender: '', date_of_birth: '', home_lc: '', start_date: '', manager_id: '',
  desired_regions: [], desired_countries: [], show_in_cvpool: false, assigned_on_expa: false,
  is_aiesecer: false, expa_id: ''
};

export default function LeadEditor({ lead, managers = [], onClose, onSaved, createMode = false }) {
  const toast = useToast();
  const { manager } = useAuth();
  const [form, setForm] = useState(BLANK);
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBg, setSelectedBg] = useState([]);
  const [busy, setBusy] = useState(false);

  const open = Boolean(lead) || createMode;

  useEffect(() => {
    if (!open) return;
    fetchBackgrounds().then(({ rows }) => setBackgrounds(rows));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        ...BLANK,
        ...lead,
        year_of_studies: lead.year_of_studies == null ? '' : String(lead.year_of_studies),
        manager_id: lead.manager_id || '',
        date_of_birth: lead.date_of_birth ? String(lead.date_of_birth).slice(0, 10) : '',
        start_date: lead.start_date ? String(lead.start_date).slice(0, 10) : '',
        desired_regions: toArray(lead.desired_regions),
        desired_countries: toArray(lead.desired_countries)
      });
      setSelectedBg((lead.backgrounds || []).map((b) => b.id));
    } else {
      setForm({ ...BLANK, manager_id: manager?.id || '' });
      setSelectedBg([]);
    }
  }, [lead, open, manager?.id]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!isSupabaseConfigured) { toast.error('Supabase is not configured.'); return; }
    if (!form.first_name && !form.full_name) { toast.error('First name is required.'); return; }
    setBusy(true);
    try {
      const payload = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        full_name: [form.first_name, form.last_name].filter(Boolean).join(' ') || null,
        email: form.email || null,
        phone_number: form.phone_number || null,
        lead_id: form.lead_id || null,
        university: form.university || null,
        product: form.product || null,
        year_of_studies: form.year_of_studies || null,
        duration: form.duration || null,
        status: form.status || 'Not Contacted',
        linkedin_url: form.linkedin_url || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        home_lc: form.home_lc || null,
        start_date: form.start_date || null,
        manager_id: form.manager_id || null,
        desired_regions: form.desired_regions,
        desired_countries: form.desired_countries,
        show_in_cvpool: Boolean(form.show_in_cvpool),
        assigned_on_expa: Boolean(form.assigned_on_expa),
        is_aiesecer: Boolean(form.is_aiesecer),
        expa_id: form.expa_id || null,
        updated_at: new Date().toISOString()
      };

      let leadId = lead?.id;
      if (leadId) {
        const { error } = await supabase.from('leads').update(payload).eq('id', leadId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('leads').insert(payload).select('id').single();
        if (error) throw error;
        leadId = data.id;
      }

      await setLeadBackgrounds(leadId, selectedBg);
      await logAction(manager?.id, lead ? 'lead_updated' : 'lead_created', { lead_id: leadId });
      toast.success(lead ? 'Lead updated.' : 'Lead created.');
      onSaved?.(leadId);
    } catch (err) {
      toast.error(err.message || 'Could not save the lead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={lead ? 'Edit Lead Details' : 'New Lead Information'}
      onClose={onClose}
      width={820}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            <FiSave /> {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <h4 className="section-heading">Personal Information</h4>
      <div className="form-grid">
        <div className="field">
          <label>First Name *</label>
          <input value={form.first_name || ''} onChange={(e) => set('first_name', e.target.value)} />
        </div>
        <div className="field">
          <label>Last Name</label>
          <input value={form.last_name || ''} onChange={(e) => set('last_name', e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="field">
          <label>Phone Number</label>
          <input value={form.phone_number || ''} onChange={(e) => set('phone_number', e.target.value)} />
        </div>
        <div className="field">
          <label>Gender</label>
          <select value={form.gender || ''} onChange={(e) => set('gender', e.target.value)}>
            <option value="">Select gender</option>
            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Date of Birth</label>
          <input type="date" value={form.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} />
        </div>
      </div>

      <h4 className="section-heading">Additional Information</h4>
      <div className="form-grid">
        <div className="field">
          <label>EP ID</label>
          <input value={form.lead_id || ''} onChange={(e) => set('lead_id', e.target.value)} />
        </div>
        <div className="field">
          <label>EXPA ID</label>
          <input value={form.expa_id || ''} onChange={(e) => set('expa_id', e.target.value)} />
        </div>
        <div className="field">
          <label>University</label>
          <input value={form.university || ''} onChange={(e) => set('university', e.target.value)} />
        </div>
        <div className="field">
          <label>Home LC</label>
          <input value={form.home_lc || ''} onChange={(e) => set('home_lc', e.target.value)} />
        </div>
        <div className="field">
          <label>Product</label>
          <select value={form.product || ''} onChange={(e) => set('product', e.target.value)}>
            <option value="">Select product</option>
            {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Year of Studies</label>
          <select value={form.year_of_studies || ''} onChange={(e) => set('year_of_studies', e.target.value)}>
            <option value="">Select year</option>
            {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Duration</label>
          <select value={form.duration || ''} onChange={(e) => set('duration', e.target.value)}>
            <option value="">Any Duration</option>
            {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={form.status || ''} onChange={(e) => set('status', e.target.value)}>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Preferred Start Date</label>
          <input type="date" value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} />
        </div>
        <div className="field">
          <label>EP Manager</label>
          <select value={form.manager_id || ''} onChange={(e) => set('manager_id', e.target.value)}>
            <option value="">Unassigned</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>LinkedIn</label>
          <input value={form.linkedin_url || ''} onChange={(e) => set('linkedin_url', e.target.value)} />
        </div>
      </div>

      <h4 className="section-heading">Preferences</h4>
      <div className="form-grid">
        <div className="field">
          <label>Desired Regions</label>
          <MultiSelect
            options={REGIONS}
            selected={form.desired_regions}
            onChange={(v) => set('desired_regions', v)}
            placeholder="Select regions"
          />
        </div>
        <div className="field">
          <label>Desired Countries (MCS)</label>
          <MultiSelect
            options={COUNTRIES}
            selected={form.desired_countries}
            onChange={(v) => set('desired_countries', v)}
            placeholder="Select countries"
          />
        </div>
        <div className="field full">
          <label>Backgrounds</label>
          <MultiSelect
            options={backgrounds.map((b) => ({ value: b.id, label: b.name }))}
            selected={selectedBg}
            onChange={setSelectedBg}
            placeholder="Select a background..."
            emptyText="No backgrounds found"
          />
        </div>
      </div>

      <div className="switch-row">
        <label className="switch">
          <input type="checkbox" checked={Boolean(form.show_in_cvpool)}
            onChange={(e) => set('show_in_cvpool', e.target.checked)} />
          <span>Show in public CV Pool</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={Boolean(form.assigned_on_expa)}
            onChange={(e) => set('assigned_on_expa', e.target.checked)} />
          <span>Assigned on EXPA</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={Boolean(form.is_aiesecer)}
            onChange={(e) => set('is_aiesecer', e.target.checked)} />
          <span>Is AIESECer</span>
        </label>
      </div>
    </Modal>
  );
}
