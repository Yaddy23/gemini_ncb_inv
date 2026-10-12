import { Search } from 'lucide-react';

/**
 * Search input + optional status filter select, in the standard white card shell.
 * Pass `searching` to show a spinner next to the placeholder.
 */
export default function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searching = false,
  status,
  onStatusChange,
  statusOptions,
  children,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
          />
          {searching && (
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
        </div>
        {onStatusChange && statusOptions && (
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full sm:w-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {children}
      </div>
    </div>
  );
}

