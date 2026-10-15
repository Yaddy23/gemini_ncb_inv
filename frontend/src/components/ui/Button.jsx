
const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90 disabled:bg-primary/50',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  danger: 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800',
};

/**
 * Standard button. `size="touch"` enforces a 44px-min touch target
 * (use for standalone mobile controls; inside dense table rows use "md").
 */
export default function Button({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }) {
  const sizeClass =
    size === 'touch'
      ? 'px-4 py-3 min-h-[44px] min-w-[44px]'
      : size === 'sm'
        ? 'px-3 py-1.5 text-sm min-h-[36px]'
        : 'px-4 py-2 min-h-[40px]';

  return (
    <button
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-lg font-medium transition-[transform,colors] active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${sizeClass} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

