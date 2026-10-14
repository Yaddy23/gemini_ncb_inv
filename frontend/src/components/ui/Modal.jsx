import { useEffect } from 'react';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

/**
 * App-wide modal.
 * - Outer wrapper scrolls (overflow-y-auto) so tall content is always reachable.
 * - Inner card max-h-[90vh] + overflow at ALL breakpoints (fixes clipped forms on phones).
 * - Header is sticky; footer wraps with 44px-min touch targets.
 * - `size="sheet"`: full-screen sheet below md (pinned header/footer, flex-1 scroll body),
 *   centered xl modal at md+.
 */
export default function Modal({ open, onClose, title, footer, size = 'md', closeOnBackdrop = true, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isSheet = size === 'sheet';
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 overflow-y-auto ${
        isSheet ? 'md:flex md:items-center md:justify-center md:p-4' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={
          isSheet
            ? 'bg-white w-full min-h-screen md:min-h-0 md:rounded-lg md:shadow-xl md:max-w-5xl md:max-h-[90vh] flex flex-col dark:bg-slate-900'
            : `bg-white rounded-lg shadow-xl w-full ${sizeClass} my-8 max-h-[90vh] overflow-y-auto flex flex-col dark:bg-slate-900`
        }
      >
        {title !== undefined && (
          <div className="sticky top-0 z-10 bg-white flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 rounded-t-lg dark:bg-slate-900 dark:border-slate-800">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate dark:text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className={`px-4 sm:px-6 py-4 sm:py-6 ${isSheet ? 'flex-1 overflow-y-auto min-h-0' : ''}`}>{children}</div>

        {footer && (
          <div
            className={`bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2 rounded-b-lg dark:bg-slate-900 dark:border-slate-800 ${
              isSheet ? 'sticky bottom-0' : ''
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

