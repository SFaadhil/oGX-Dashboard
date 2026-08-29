import { useEffect, useState } from 'react';
import { FiX, FiZap, FiWifiOff, FiSmartphone } from 'react-icons/fi';
import './InstallPrompt.css';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('ogx_india_install_dismissed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!deferred || dismissed) return null;

  const install = async () => {
    setOpen(false);
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const dismiss = () => {
    setOpen(false);
    setDismissed(true);
    try { localStorage.setItem('ogx_india_install_dismissed', '1'); } catch { /* ignore */ }
  };

  return (
    <>
      <button className="install-trigger-btn" aria-label="Install App" onClick={() => setOpen(true)}>
        <img className="trigger-logo" src="/aiesec-india.svg" alt="oGX INDIA" />
      </button>

      {open && (
        <div className="install-sheet">
          <button className="install-close" onClick={() => setOpen(false)} aria-label="Close"><FiX /></button>
          <h3>Install oGX INDIA</h3>
          <p>Get the full app experience</p>
          <ul>
            <li><FiZap /> Lightning speed</li>
            <li><FiWifiOff /> Work anywhere</li>
            <li><FiSmartphone /> One tap from your home screen</li>
          </ul>
          <div className="install-actions">
            <button className="btn btn-ghost" onClick={dismiss}>Not Now</button>
            <button className="btn btn-primary" onClick={install}>Install</button>
          </div>
        </div>
      )}
    </>
  );
}
