
const TONES = {
  issued: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  completed: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  active: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
  disabled: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
  out_for_delivery: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  returned: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
};

const LABELS = {
  issued: 'Issued',
  completed: 'Completed',
  active: 'Active',
  cancelled: 'Cancelled',
  revoked: 'Revoked',
  draft: 'Draft',
  pending: 'Pending',
  disabled: 'Disabled',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  returned: 'Returned',
};

/**
 * Canonical status pill. One class set for the whole app.
 * Unknown statuses render as neutral gray.
 */
export default function StatusBadge({ status, label }) {
  const key = String(status || '').toLowerCase();
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${TONES[key] || 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>
      {label || LABELS[key] || status}
    </span>
  );
}

