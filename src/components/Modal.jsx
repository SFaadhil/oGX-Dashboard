import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import './Modal.css';

export default function Modal({ open, title, onClose, children, footer, width = 640 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-panel" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><FiX /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
