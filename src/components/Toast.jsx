import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import './Toast.css';

const ToastContext = createContext(null);

const ICONS = { success: FiCheckCircle, error: FiAlertCircle, info: FiInfo };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info')
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] || FiInfo;
          return (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <Icon /> <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
