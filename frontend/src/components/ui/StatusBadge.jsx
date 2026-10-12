
const TONES = {
  issued: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  revoked: 'bg-red-100 text-red-800',
  draft: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  disabled: 'bg-gray-100 text-gray-600',
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
};

/**
 * Canonical status pill. One class set for the whole app.
 * Unknown statuses render as neutral gray.
 */
export default function StatusBadge({ status, label }) {
  const key = String(status || '').toLowerCase();
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${TONES[key] || 'bg-gray-100 text-gray-600'}`}>
      {label || LABELS[key] || status}
    </span>
  );
}

