import { useEffect, useState } from 'react';
import { FiSave, FiMoon, FiSun, FiUser, FiLock, FiInfo } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { initials, formatDateTime } from '../lib/helpers';

export default function Settings() {
  const { manager, refresh } = useAuth();
  const { theme, saveThemeFor } = useTheme();
  const toast = useToast();

  const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '', profile_picture: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!manager) return;
    setForm({
      first_name: manager.first_name || '',
      last_name: manager.last_name || '',
      phone_number: manager.phone_number || '',
      profile_picture: manager.profile_picture || ''
    });
  }, [manager]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async () => {
    if (!isSupabaseConfigured) { toast.error('Supabase is not configured.'); return; }
    setBusy(true);
    const { error } = await supabase.from('managers').update(form).eq('id', manager.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success('Profile updated.');
  };

  const changePassword = async () => {
    if (!pw.next || pw.next !== pw.confirm) { toast.error('New passwords do not match.'); return; }
    const { data } = await supabase
      .from('managers')
      .select('password')
      .eq('id', manager.id)
      .maybeSingle();
    if (!data || data.password !== pw.current) { toast.error('Current password is incorrect.'); return; }
    const { error } = await supabase.from('managers').update({ password: pw.next }).eq('id', manager.id);
    if (error) { toast.error(error.message); return; }
    setPw({ current: '', next: '', confirm: '' });
    toast.success('Password changed.');
  };

  const name = [manager?.first_name, manager?.last_name].filter(Boolean).join(' ');

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Your profile, theme and password.</p>
        </div>
      </div>

      <div className="two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiUser /> Personal Information</h3></div>
            <div className="panel-body">
              <div className="profile-strip">
                <div className="hero-avatar">
                  {form.profile_picture
                    ? <img src={form.profile_picture} alt={name} />
                    : initials(name || manager?.email || '?')}
                </div>
                <div>
                  <strong>{name || 'Member'}</strong>
                  <span>{manager?.key_area || 'Team Member'}{manager?.ogt ? ` - ${manager.ogt}` : ''}</span>
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '1rem' }}>
                <div className="field">
                  <label>First Name</label>
                  <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Last Name</label>
                  <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Phone Number</label>
                  <input value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} />
                </div>
                <div className="field">
                  <label>Profile Picture URL</label>
                  <input value={form.profile_picture} onChange={(e) => set('profile_picture', e.target.value)} />
                </div>
                <div className="field full">
                  <label>Email</label>
                  <input value={manager?.email || ''} disabled />
                  <span className="tile-sub">Email cannot be changed</span>
                </div>
                <div className="field full">
                  <label>Key Area</label>
                  <input value={manager?.key_area || ''} disabled />
                  <span className="tile-sub">Key area is assigned by admin</span>
                </div>
              </div>

              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={saveProfile} disabled={busy}>
                <FiSave /> {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiLock /> Password</h3></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field">
                  <label>Current password</label>
                  <input type="password" value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
                </div>
                <div className="field">
                  <label>New password</label>
                  <input type="password" value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Confirm new password</label>
                  <input type="password" value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={changePassword}>
                <FiSave /> Update password
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="panel">
            <div className="panel-head"><h3><FiMoon /> Theme Preferences</h3></div>
            <div className="panel-body">
              <div className="theme-choices">
                <button
                  className={`theme-choice${theme === 'light' ? ' on' : ''}`}
                  onClick={() => saveThemeFor(manager?.id, 'light')}
                >
                  <FiSun /> Light
                </button>
                <button
                  className={`theme-choice${theme === 'dark' ? ' on' : ''}`}
                  onClick={() => saveThemeFor(manager?.id, 'dark')}
                >
                  <FiMoon /> Dark
                </button>
              </div>
              <p className="tile-sub" style={{ marginTop: '0.75rem' }}>
                Saved to your profile so it follows you across devices.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3><FiInfo /> Account</h3></div>
            <div className="panel-body">
              <div className="kv-grid">
                <div className="kv-item"><span>EXPA ID</span><strong>{manager?.expa_id || '-'}</strong></div>
                <div className="kv-item"><span>oGT Team</span><strong>{manager?.ogt || '-'}</strong></div>
                <div className="kv-item"><span>Last Login</span><strong>{formatDateTime(manager?.last_login) || '-'}</strong></div>
                <div className="kv-item"><span>Member Since</span><strong>{formatDateTime(manager?.created_at) || '-'}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
