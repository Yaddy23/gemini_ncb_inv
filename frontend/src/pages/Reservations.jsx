import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronDown, ExternalLink, Loader, RefreshCw, Trash2, Unlock } from 'lucide-react';
import { reservationsApi } from '../api/reservations';
import { drsiApi } from '../api/drsi';
import { formatDate } from '../utils/numberToWords';
import { useToast } from '../components/Toast';
import { AlertBanner, EmptyState, ListToolbar, Skeleton } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';

const STALE_FILTER_OPTIONS = [
  { value: '', label: 'All reservations' },
  { value: 'stale', label: 'Stale only' },
];

const StatTile = ({ label, value, accent = false }) => (
  <div className={`rounded-xl shadow-sm border p-4 ${
    accent
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/40'
      : 'bg-white border-gray-100 dark:bg-slate-900 dark:border-slate-800'
  }`}>
    <p className={`text-sm ${accent ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-slate-400'}`}>{label}</p>
    <p className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-slate-100'}`}>{value}</p>
  </div>
);

const AgeBadge = ({ hold }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
    hold.stale
      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
  }`}>
    {hold.ageDays} {hold.ageDays === 1 ? 'day' : 'days'}{hold.stale ? ' · stale' : ''}
  </span>
);

const Reservations = ({ user }) => {
  const [holds, setHolds] = useState([]);
  const [summary, setSummary] = useState({ totalHolds: 0, totalUnits: 0, staleCount: 0 });
  const [expiryDays, setExpiryDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [staleFilter, setStaleFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [releasing, setReleasing] = useState(null);
  const [removingItem, setRemovingItem] = useState(null); // "${drId}:${isbn}" while a per-item release is in flight
  const [expiring, setExpiring] = useState(false);
  const [expireResult, setExpireResult] = useState(null);

  const { toast, confirmDialog } = useToast();
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 400);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reservationsApi.getReservations();
      setHolds(response.data.holds || []);
      setSummary(response.data.summary || { totalHolds: 0, totalUnits: 0, staleCount: 0 });
      setExpiryDays(response.data.expiryDays ?? null);
    } catch (err) {
      console.error('Failed to fetch reservations:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const filteredHolds = useMemo(() => {
    let list = holds;
    if (staleFilter === 'stale') list = list.filter((h) => h.stale);
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((h) =>
        h.drNumber?.toLowerCase().includes(q) ||
        h.customerName?.toLowerCase().includes(q) ||
        h.items?.some((it) =>
          it.isbn?.toLowerCase().includes(q) || it.title?.toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [holds, staleFilter, debouncedSearch]);

  const toggleExpanded = (drId) => {
    setExpandedId((prev) => (prev === drId ? null : drId));
  };

  const handleOpenDR = (hold) => {
    navigate('/delivery-receipts', { state: { focusId: hold.drId } });
  };

  const handleRelease = async (hold) => {
    const sure = await confirmDialog(
      `Release this reservation? Deleting draft DR ${hold.drNumber} will return ${hold.totalQty} units to available stock.`,
      { title: 'Release Reservation', danger: true, confirmText: 'Release' }
    );
    if (!sure) return;
    setReleasing(hold.drId);
    try {
      await drsiApi.deleteDR(hold.drId);
      toast.success(`Reservation released — ${hold.totalQty} units returned to available stock`);
      if (expandedId === hold.drId) setExpandedId(null);
      fetchReservations();
    } catch (err) {
      toast.error('Release failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setReleasing(null);
    }
  };

  const handleRemoveItem = async (hold, item, lineIndex) => {
    const sure = await confirmDialog(
      `Remove "${item.title}" from reservation ${hold.drNumber}? ${item.qty} unit(s) will return to available stock.${hold.items.length === 1 ? ' This is the last item — the whole reservation (draft DR) will be released.' : ''}`,
      { title: 'Remove Book from Reservation', danger: true, confirmText: 'Remove' }
    );
    if (!sure) return;
    const key = `${hold.drId}:${item.isbn}`;
    setRemovingItem(key);
    try {
      const response = await reservationsApi.releaseItem(hold.drId, item.isbn, lineIndex);
      const result = response.data || {};
      if (result.deleted) {
        toast.success('Reservation fully released — draft DR deleted');
        if (expandedId === hold.drId) setExpandedId(null);
      } else {
        toast.success(result.message || `${item.qty} unit(s) returned to available stock`);
      }
      fetchReservations();
    } catch (err) {
      toast.error('Remove failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setRemovingItem(null);
    }
  };

  const handleExpireStale = async () => {
    const sure = await confirmDialog(
      `Expire all stale reservations? This will delete ${summary.staleCount} stale draft DR(s) and return their units to available stock.`,
      { title: 'Expire Stale Reservations', danger: true, confirmText: 'Expire' }
    );
    if (!sure) return;
    setExpiring(true);
    try {
      const response = await reservationsApi.expireStale();
      const result = response.data || {};
      const released = result.released ?? result.releasedCount ?? 0;
      const failed = result.failed || result.failures || [];
      setExpireResult({ released, failed });
      toast.success(`Expired ${released} stale reservation${released === 1 ? '' : 's'}${failed.length ? ` — ${failed.length} failed` : ''}`);
      fetchReservations();
    } catch (err) {
      toast.error('Expire failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setExpiring(false);
    }
  };

  const renderItemRow = (hold, item, idx) => (
    <tr key={idx}>
      <td className="px-3 py-2 text-xs font-mono text-gray-600 dark:text-slate-400 whitespace-nowrap">{item.isbn}</td>
      <td className="px-3 py-2 text-xs text-gray-700 dark:text-slate-300">{item.title}</td>
      <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-slate-100 text-right whitespace-nowrap">{item.qty}</td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => handleRemoveItem(hold, item, idx)}
          disabled={removingItem === `${hold.drId}:${item.isbn}`}
          className="inline-flex items-center justify-center space-x-1 px-2.5 py-2 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 transition-colors touch-manipulation min-h-[44px] text-xs font-medium disabled:opacity-50"
          title={`Remove ${item.title} from this reservation`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{removingItem === `${hold.drId}:${item.isbn}` ? 'Removing...' : 'Remove'}</span>
        </button>
      </td>
    </tr>
  );

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center space-x-3">
            <Bookmark className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
            <span>Reservations</span>
          </h1>
          <p className="mt-1 text-gray-600 dark:text-slate-400">Stock held by draft Delivery Receipts until they are issued or released</p>
        </div>
        <button
          onClick={fetchReservations}
          className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation min-h-[44px] dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <AlertBanner tone="error">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>Failed to load reservations: {error}</span>
            <button
              onClick={fetchReservations}
              className="self-start sm:self-auto px-4 underline font-medium rounded touch-manipulation min-h-[44px]"
            >
              Retry
            </button>
          </div>
        </AlertBanner>
      )}

      {/* Expire-stale result */}
      {expireResult && (
        <AlertBanner tone="warning" onClose={() => setExpireResult(null)}>
          <p className="font-medium">
            Expired {expireResult.released} stale reservation{expireResult.released === 1 ? '' : 's'}.
          </p>
          {expireResult.failed.length > 0 && (
            <div className="mt-1">
              <p>Failed to release:</p>
              <ul className="list-disc list-inside mt-1">
                {expireResult.failed.map((f, i) => (
                  <li key={i}>
                    {f.drNumber || f.drId || String(f)}{f.error ? ` — ${f.error}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AlertBanner>
      )}

      {/* Summary strip */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile label="Total reserved units" value={summary.totalUnits} />
          <StatTile label="Active holds" value={summary.totalHolds} />
          <StatTile label="Stale holds" value={summary.staleCount} accent={summary.staleCount > 0} />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Auto-expiry: {expiryDays == null ? 'off' : `${expiryDays} days`}
          </p>
          {user?.role === 'Admin' && (
            <button
              onClick={handleExpireStale}
              disabled={summary.staleCount === 0 || expiring}
              className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {expiring ? <Loader className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
              <span>Expire stale ({summary.staleCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by DR number, customer, ISBN or title..."
        status={staleFilter}
        onStatusChange={setStaleFilter}
        statusOptions={STALE_FILTER_OPTIONS}
      />

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <>
            {/* Mobile: skeleton cards */}
            <div className="block md:hidden p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
            {/* Desktop: skeleton rows under the real header */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">DR #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Reserved By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Age</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {[...Array(5)].map((_, r) => (
                    <tr key={r}>
                      {Array.from({ length: 7 }).map((_, c) => (
                        <td key={c} className="px-4 py-3">
                          <Skeleton className="h-4 w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : filteredHolds.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No active reservations"
            message="Reservations appear when a draft Delivery Receipt reserves stock. They are released when the DR is issued, deleted, or expires."
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-200 dark:divide-slate-800">
                {filteredHolds.map((hold) => (
                  <div key={hold.drId} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate font-mono">{hold.drNumber}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{hold.customerName}</p>
                      </div>
                      <AgeBadge hold={hold} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Units</p>
                        <p className="font-medium text-gray-900 dark:text-slate-100">{hold.totalQty}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Reserved By</p>
                        <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{hold.reservedBy || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-400 dark:text-slate-500">Created</p>
                        <p className="font-medium text-gray-900 dark:text-slate-100">{formatDate(hold.createdAt)}</p>
                      </div>
                    </div>
                    {/* Items */}
                    <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-3 mb-3 space-y-1">
                      {hold.items?.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-700 dark:text-slate-300 truncate" title={`${it.isbn} — ${it.title}`}>
                            <span className="font-mono text-gray-500 dark:text-slate-400">{it.isbn}</span> · {it.title}
                          </span>
                          <span className="flex items-center flex-shrink-0">
                            <span className="font-medium text-gray-900 dark:text-slate-100 mr-1">×{it.qty}</span>
                            <button
                              onClick={() => handleRemoveItem(hold, it, idx)}
                              disabled={removingItem === `${hold.drId}:${it.isbn}`}
                              className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                              title={`Remove ${it.title} from this reservation`}
                              aria-label={`Remove ${it.title} from this reservation`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleOpenDR(hold)}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 touch-manipulation min-h-[44px] transition-colors"
                        title="Open the draft Delivery Receipt"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-sm font-medium">Open DR</span>
                      </button>
                      <button
                        onClick={() => handleRelease(hold)}
                        disabled={releasing === hold.drId}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title="Release reservation"
                      >
                        <Unlock className="w-4 h-4" />
                        <span className="text-sm font-medium">{releasing === hold.drId ? 'Releasing...' : 'Release'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">DR #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Reserved By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Age</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {filteredHolds.map((hold) => (
                    <React.Fragment key={hold.drId}>
                      <tr
                        onClick={() => toggleExpanded(hold.drId)}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform duration-200 ${expandedId === hold.drId ? 'rotate-180' : ''}`}
                            />
                            <span className="font-mono text-sm font-medium text-gray-900 dark:text-slate-100">{hold.drNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{hold.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                          {hold.items?.length || 0} {hold.items?.length === 1 ? 'title' : 'titles'} / {hold.totalQty} units
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{hold.reservedBy || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(hold.createdAt)}</td>
                        <td className="px-4 py-3"><AgeBadge hold={hold} /></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-2 justify-end">
                            <button
                              onClick={() => handleOpenDR(hold)}
                              className="flex items-center space-x-1 px-3 py-2 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors touch-manipulation min-h-[44px] text-sm font-medium"
                              title="Open the draft Delivery Receipt"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Open DR</span>
                            </button>
                            <button
                              onClick={() => handleRelease(hold)}
                              disabled={releasing === hold.drId}
                              className="flex items-center space-x-1 px-3 py-2 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 transition-colors touch-manipulation min-h-[44px] text-sm font-medium disabled:opacity-50"
                              title="Release reservation"
                            >
                              <Unlock className="w-4 h-4" />
                              <span>{releasing === hold.drId ? 'Releasing...' : 'Release'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Always rendered; collapses via grid-rows so the
                          expand/collapse animates instead of popping */}
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className={`grid transition-all duration-200 ease-out ${expandedId === hold.drId ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                              <div className="px-4 pb-4">
                                <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800">
                                  <table className="min-w-full">
                                    <thead>
                                      <tr className="bg-gray-50 dark:bg-slate-800/60">
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">ISBN</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Title</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Qty</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                                      {hold.items?.map((item, idx) => renderItemRow(hold, item, idx))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reservations;
