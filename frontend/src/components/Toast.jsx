import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_DURATION = 4000;

// Matches --motion-fast: duration of the fade-out exit animation
const EXIT_MS = 150;

const TOAST_CONFIG = {
  success: { icon: CheckCircle, border: 'border-l-green-500', iconColor: 'text-green-500' },
  error: { icon: AlertCircle, border: 'border-l-red-500', iconColor: 'text-red-500' },
  info: { icon: Info, border: 'border-l-blue-500', iconColor: 'text-blue-500' }
};

let nextId = 0;

const ToastItem = ({ toast, onClose }) => {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`flex items-start space-x-3 w-full max-w-sm bg-white shadow-lg rounded-lg border border-gray-100 border-l-4 p-4 dark:bg-slate-900 dark:border-slate-800 ${config.border} ${
        toast.closing ? 'animate-fade-out' : 'animate-slide-up'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className="flex-1 text-sm text-gray-700 break-words dark:text-slate-300">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 p-1 -m-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const DialogItem = ({ dialog, isTop, onResolve }) => {
  const { kind, message, options } = dialog;
  const title = options.title || (kind === 'prompt' ? 'Input' : 'Confirm');
  const [value, setValue] = useState(options.defaultValue || '');
  const inputRef = useRef(null);

  // Autofocus the text input in prompt dialogs
  useEffect(() => {
    if (kind === 'prompt' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [kind]);

  const resolve = useCallback(
    (result) => onResolve(dialog.id, result),
    [dialog.id, onResolve]
  );

  // Keyboard handling for the topmost dialog only:
  // Escape cancels, Enter confirms with the current value
  useEffect(() => {
    if (!isTop) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolve(kind === 'prompt' ? null : false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        resolve(kind === 'prompt' ? value : true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTop, kind, value, resolve]);

  const cancel = () => resolve(kind === 'prompt' ? null : false);
  const confirm = () => resolve(kind === 'prompt' ? value : true);

  const confirmButtonClass = options.danger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-primary hover:bg-primary/90 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={cancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6 dark:bg-slate-900"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-2 dark:text-slate-100">{title}</h3>
        <p className="text-gray-600 mb-4 break-words dark:text-slate-400">{message}</p>
        {kind === 'prompt' && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={options.placeholder || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4 dark:border-slate-600 dark:placeholder-slate-500 dark:focus:ring-blue-500"
          />
        )}
        <div className="flex justify-end space-x-3">
          <button
            onClick={cancel}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800/60 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className={`px-4 py-2 rounded-lg ${confirmButtonClass}`}
          >
            {options.confirmText || (kind === 'prompt' ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialogs, setDialogs] = useState([]);
  const dialogsRef = useRef([]);
  const timersRef = useRef({});
  const closingIdsRef = useRef(new Set());

  // Every dismissal (auto-timeout and manual X) routes through here: mark the
  // toast closing, play the exit animation, then remove it from state.
  const dismissToast = useCallback((id) => {
    if (closingIdsRef.current.has(id)) return;
    closingIdsRef.current.add(id);
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, closing: true } : t)));
    // Clear the auto-dismiss timer if it hasn't fired yet
    if (timersRef.current[id] !== undefined) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    timersRef.current[id] = setTimeout(() => {
      delete timersRef.current[id];
      closingIdsRef.current.delete(id);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, EXIT_MS);
  }, []);

  const addToast = useCallback((type, message) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, type, message }]);
    timersRef.current[id] = setTimeout(() => dismissToast(id), TOAST_DURATION);
  }, [dismissToast]);

  // Clear any pending timers if the provider unmounts
  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
  }, []);

  const toast = useMemo(() => ({
    success: (message) => addToast('success', message),
    error: (message) => addToast('error', message),
    info: (message) => addToast('info', message)
  }), [addToast]);

  const resolveDialog = useCallback((id, result) => {
    const dialog = dialogsRef.current.find(d => d.id === id);
    if (!dialog) return;
    dialogsRef.current = dialogsRef.current.filter(d => d.id !== id);
    setDialogs([...dialogsRef.current]);
    dialog.resolve(result);
  }, []);

  const openDialog = useCallback((kind, message, options) => {
    return new Promise((resolve) => {
      const dialog = { id: ++nextId, kind, message, options: options || {}, resolve };
      dialogsRef.current = [...dialogsRef.current, dialog];
      setDialogs([...dialogsRef.current]);
    });
  }, []);

  const confirmDialog = useCallback(
    (message, options) => openDialog('confirm', message, options),
    [openDialog]
  );

  const promptDialog = useCallback(
    (message, options) => openDialog('prompt', message, options),
    [openDialog]
  );

  return (
    <ToastContext.Provider value={{ toast, confirmDialog, promptDialog }}>
      {children}

      {/* Toasts - fixed top-right, stacked */}
      <div className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={dismissToast} />
          </div>
        ))}
      </div>

      {/* Dialogs - stacked, later dialogs render above earlier ones */}
      {dialogs.map((d, index) => (
        <DialogItem
          key={d.id}
          dialog={d}
          isTop={index === dialogs.length - 1}
          onResolve={resolveDialog}
        />
      ))}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastProvider;
