
/**
 * Shared pagination footer: "Showing X–Y of Z" + prev/next.
 * Transcribed from the best existing inline copy (Books.jsx).
 */
export default function Pagination({ page, totalPages, total, limit, onPageChange, label = 'items' }) {
  if (!total || total <= limit) return null;

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gray-50">
      <p className="text-sm text-gray-500 text-center sm:text-left">
        Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} {label}
      </p>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={`flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] ${
            page === 1 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
          aria-label="Previous page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="px-3 py-1 text-sm font-medium flex items-center justify-center w-10">{page}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={`flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] ${
            page === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
          aria-label="Next page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

