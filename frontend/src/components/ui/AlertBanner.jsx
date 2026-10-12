
const TONES = {
  error: 'bg-red-50 border-red-400 text-red-700',
  success: 'bg-green-50 border-green-400 text-green-700',
  info: 'bg-blue-50 border-blue-400 text-blue-700',
  warning: 'bg-yellow-50 border-yellow-400 text-yellow-700',
};

/** Inline alert with the app-wide `border-l-4` look. */
export default function AlertBanner({ tone = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`border-l-4 p-4 mb-4 rounded-r-lg flex items-start justify-between gap-3 ${TONES[tone] || TONES.info}`} role="alert">
      <div className="text-sm flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 p-1 -m-1" aria-label="Dismiss">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

