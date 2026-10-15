import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, FileText, Edit, Trash2, Eye, AlertTriangle, CheckCircle, User, XCircle, FileOutput, Undo2 } from 'lucide-react';
import { drsiApi } from '../api/drsi';
import DocumentForm from '../components/drsi/DocumentForm';
import DocumentPreview from '../components/drsi/DocumentPreview';
import { formatDate, formatCurrency } from '../utils/numberToWords';
import { useToast } from '../components/Toast';
import { Pagination, StatusBadge, EmptyState, ListToolbar, Skeleton } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DELIVERY_OPTIONS = [
  { value: '', label: 'All Delivery' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
];

const DeliveryReceipts = ({ user }) => {
  const [drs, setDRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDR, setEditingDR] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [deliveryUpdating, setDeliveryUpdating] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [linkedSI, setLinkedSI] = useState(null);
  const [showPop, setShowPop] = useState(false);
  const [flashId, setFlashId] = useState(null);

  const location = useLocation();
  const popTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const pendingFocusRef = useRef(null);

  const { toast, confirmDialog, promptDialog } = useToast();

  const debouncedSearch = useDebounce(search, 400);

  // Trigger + auto-dismiss the success "pop" (Feature 35). The timer id is
  // kept in a ref so a retrigger resets it and unmount cleans it up.
  const triggerPop = () => {
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    setShowPop(true);
    popTimerRef.current = setTimeout(() => setShowPop(false), 1200);
  };

  useEffect(() => () => {
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const fetchDRs = async () => {
    setLoading(true);
    try {
      const response = await drsiApi.getDRs({
        search: debouncedSearch,
        status: statusFilter,
        deliveryStatus: deliveryFilter,
        page,
        limit: 20
      });
      setDRs(response.data.drs);
      setTotal(response.data.total);
      setTotalPages(response.data.pages);
    } catch (err) {
      console.error('Failed to fetch DRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDRs();
  }, [debouncedSearch, statusFilter, deliveryFilter, page]);

  // Feature 35: Reservations deep-links here with { state: { focusId } }.
  // Once DRs load, flash + scroll to that row if it is on the current page,
  // then strip the history state so a refresh doesn't re-flash.
  useEffect(() => {
    const focusId = location.state?.focusId;
    if (focusId) {
      pendingFocusRef.current = focusId;
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    const focusId = pendingFocusRef.current;
    if (!focusId || loading) return;
    pendingFocusRef.current = null;
    if (drs.some((d) => d._id === focusId)) {
      setFlashId(focusId);
      requestAnimationFrame(() => {
        document.getElementById(`dr-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashId(null), 1600);
    }
  }, [loading, drs]);

  const handleSubmit = async (data, action) => {
    setSubmitting(true);
    try {
      let docId;
      if (editingDR) {
        await drsiApi.updateDR(editingDR._id, data);
        docId = editingDR._id;
      } else {
        const response = await drsiApi.createDR(data);
        docId = response.data._id;
      }

      if (action === 'issue') {
        await drsiApi.issueDR(docId);
        triggerPop();
      }

      setFormOpen(false);
      setEditingDR(null);
      fetchDRs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dr) => {
    setPreviewDoc(null);
    setLinkedSI(null);
    setEditingDR(dr);
    setFormOpen(true);
  };

  const handleNew = () => {
    setPreviewDoc(null);
    setLinkedSI(null);
    setEditingDR(null);
    setFormOpen(true);
  };

  const openPreview = (doc, type) => {
    setFormOpen(false);
    setEditingDR(null);
    setLinkedSI(null);
    setPreviewDoc({ doc, type });
  };

  const handleOpenLinkedSI = async (dr) => {
    try {
      const res = await drsiApi.getSIs({ drRef: dr._id });
      const si = res.data.sis?.[0];
      if (!si) {
        toast.info('No linked sales invoice');
        return;
      }
      if (si.status === 'draft') {
        setPreviewDoc(null);
        setFormOpen(false);
        setEditingDR(null);
        setLinkedSI(si);
      } else {
        openPreview(si, 'SI');
      }
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleLinkedSISubmit = async (data, action) => {
    setSubmitting(true);
    try {
      await drsiApi.updateSI(linkedSI._id, data);
      if (action === 'issue') await drsiApi.issueSI(linkedSI._id);
      setLinkedSI(null);
      toast.success(action === 'issue' ? 'Sales invoice issued' : 'Sales invoice updated');
      fetchDRs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const sure = await confirmDialog('Delete this Delivery Receipt?', { title: 'Delete Document', danger: true, confirmText: 'Delete' });
    if (!sure) return;
    try {
      await drsiApi.deleteDR(id);
      fetchDRs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancel = async (id) => {
    const reason = await promptDialog('Enter cancellation reason:', { title: 'Cancel Document' });
    if (!reason || !reason.trim()) return;
    const sure = await confirmDialog('Cancel this delivery receipt? Its quantities will be restored to stock. This cannot be undone.', { title: 'Cancel Document', danger: true, confirmText: 'Cancel Document' });
    if (!sure) return;
    setCancelling(id);
    try {
      await drsiApi.cancelDR(id, reason.trim());
      toast.success('Document cancelled');
      fetchDRs();
    } catch (err) {
      toast.error('Cancel failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setCancelling(null);
    }
  };

  const handleExportExcel = async (id) => {
    try {
      const response = await drsiApi.exportDR(id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dr = drs.find(d => d._id === id);
      link.download = `${dr?.drNumber || 'DR'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const handleMarkDelivered = async (id) => {
    const sure = await confirmDialog('Mark this delivery receipt as delivered?', { title: 'Mark Delivered', confirmText: 'Mark Delivered' });
    if (!sure) return;
    setDeliveryUpdating(id);
    try {
      await drsiApi.markDRDelivered(id);
      toast.success('DR marked as delivered');
      triggerPop();
      fetchDRs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeliveryUpdating(null);
    }
  };

  const handleMarkReturned = async (dr) => {
    const reason = await promptDialog('Enter return reason:', { title: 'Return DR' });
    if (!reason || !reason.trim()) return;
    const sure = await confirmDialog('Return this delivery receipt? Its quantities will be restored to stock. This cannot be undone.', { title: 'Return Document', danger: true, confirmText: 'Return Document' });
    if (!sure) return;
    setDeliveryUpdating(dr._id);
    try {
      await drsiApi.markDRReturned(dr._id, reason.trim());
      toast.success('DR returned to stock');
      triggerPop();
      fetchDRs();
    } catch (err) {
      toast.error('Return failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeliveryUpdating(null);
    }
  };

  const getStatusBadge = (status) => <StatusBadge status={status} />;

  const showDeliveryChip = (dr) => dr.status === 'issued' && !dr.efRef && dr.deliveryStatus && dr.deliveryStatus !== 'pending';

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center space-x-3">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
            <span>Delivery Receipts</span>
          </h1>
          <p className="mt-1 text-gray-600 dark:text-slate-400">Manage delivery receipts and generate sales invoices</p>
        </div>
        <button onClick={handleNew} className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] min-w-[140px]">
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New DR</span>
        </button>
      </div>

      {/* Search & Filter */}
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by DR number or customer..."
        status={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
        statusOptions={STATUS_OPTIONS}
      >
        <select
          value={deliveryFilter}
          onChange={(e) => { setDeliveryFilter(e.target.value); setPage(1); }}
          className="w-full sm:w-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base dark:border-slate-600 dark:placeholder-slate-500 dark:focus:ring-blue-500"
        >
          {DELIVERY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      {/* Table */}
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
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">DR Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">EF Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {[...Array(5)].map((_, r) => (
                    <tr key={r}>
                      {Array.from({ length: 10 }).map((_, c) => (
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
        ) : drs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No delivery receipts found"
            action={
              <button onClick={handleNew} className="text-primary dark:text-blue-400 hover:underline touch-manipulation min-h-[44px]">Create your first DR</button>
            }
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-200 dark:divide-slate-800">
                {drs.map((dr) => (
                  <div
                    key={dr._id}
                    id={`dr-${dr._id}`}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-800/60 ${flashId === dr._id ? 'flash-highlight' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate font-mono">{dr.drNumber}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{dr.customerName}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-wrap gap-1.5 justify-end">
                        {getStatusBadge(dr.status)}
                        {showDeliveryChip(dr) && <StatusBadge status={dr.deliveryStatus} />}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Date</p>
                        <p className="font-medium">{formatDate(dr.date)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Items</p>
                        <p className="font-medium">{dr.items?.length || 0} items</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Requested By</p>
                        <p className="font-medium flex items-center space-x-1">
                          {dr.marketingExecutive ? (
                            <>
                              <User className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                              <span>{dr.marketingExecutive.name || dr.marketingExecutive}</span>
                            </>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">—</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Total</p>
                        <p className="font-medium text-right">{formatCurrency(dr.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">EF Ref</p>
                        <p className="font-medium">{dr.efRef ? dr.efRef.efNumber : '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Created</p>
                        <p className="font-medium">{formatDate(dr.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openPreview(dr, 'DR')}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 touch-manipulation min-h-[44px] transition-colors"
                        title="Preview document"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-sm font-medium">View</span>
                      </button>
                      {(dr.status === 'issued' || dr.status === 'cancelled') && (
                        <button
                          onClick={() => handleOpenLinkedSI(dr)}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/30 touch-manipulation min-h-[44px] transition-colors"
                          title="Open linked sales invoice"
                        >
                          <FileOutput className="w-4 h-4" />
                          <span className="text-sm font-medium">SI</span>
                        </button>
                      )}
                      {dr.status === 'issued' && !dr.efRef && dr.deliveryStatus === 'out_for_delivery' && (
                        <button
                          onClick={() => handleMarkDelivered(dr._id)}
                          disabled={deliveryUpdating === dr._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-green-50 dark:bg-emerald-500/15 text-green-700 dark:text-emerald-400 rounded-lg hover:bg-green-100 dark:hover:bg-emerald-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                          title="Mark as delivered"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Delivered</span>
                        </button>
                      )}
                      {dr.status === 'issued' && !dr.efRef && dr.deliveryStatus === 'out_for_delivery' && (
                        <button
                          onClick={() => handleMarkReturned(dr)}
                          disabled={deliveryUpdating === dr._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                          title="Return to stock"
                        >
                          <Undo2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Return</span>
                        </button>
                      )}
                      {user?.role === 'Admin' && dr.status === 'issued' && (
                        <button
                          onClick={() => handleCancel(dr._id)}
                          disabled={cancelling === dr._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                          title="Cancel document"
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Cancel</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleExportExcel(dr._id)}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-green-50 dark:bg-emerald-500/15 text-green-700 dark:text-emerald-400 rounded-lg hover:bg-green-100 dark:hover:bg-emerald-500/30 touch-manipulation min-h-[44px] transition-colors"
                        title="Download Excel"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">Excel</span>
                      </button>
                      <button
                        onClick={() => handleEdit(dr)}
                        disabled={dr.status !== 'draft'}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title={dr.status !== 'draft' ? 'Cannot edit issued/cancelled DR' : 'Edit'}
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(dr._id)}
                        disabled={dr.status !== 'draft'}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title={dr.status !== 'draft' ? 'Cannot delete issued/cancelled DR' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">DR Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">EF Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {drs.map((dr) => (
                    <tr
                      key={dr._id}
                      id={`dr-${dr._id}`}
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800/60 ${flashId === dr._id ? 'flash-highlight' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 dark:text-slate-100">{dr.drNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{formatDate(dr.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{dr.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 flex items-center space-x-1">
                        {dr.marketingExecutive ? (
                          <>
                            <User className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                            <span>{dr.marketingExecutive.name || dr.marketingExecutive}</span>
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{dr.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 text-right">{formatCurrency(dr.totalAmount)}</td>
                      <td className="px-4 py-3">
                        {showDeliveryChip(dr) ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getStatusBadge(dr.status)}
                            <StatusBadge status={dr.deliveryStatus} />
                          </div>
                        ) : (
                          getStatusBadge(dr.status)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                        {dr.efRef ? dr.efRef.efNumber : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(dr.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 justify-end">
                          <button
                            onClick={() => openPreview(dr, 'DR')}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(dr.status === 'issued' || dr.status === 'cancelled') && (
                            <button
                              onClick={() => handleOpenLinkedSI(dr)}
                              className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Open linked sales invoice"
                            >
                              <FileOutput className="w-4 h-4" />
                            </button>
                          )}
                          {dr.status === 'issued' && !dr.efRef && dr.deliveryStatus === 'out_for_delivery' && (
                            <button
                              onClick={() => handleMarkDelivered(dr._id)}
                              disabled={deliveryUpdating === dr._id}
                              className="p-2 text-green-700 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-500/20 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Mark as delivered"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {dr.status === 'issued' && !dr.efRef && dr.deliveryStatus === 'out_for_delivery' && (
                            <button
                              onClick={() => handleMarkReturned(dr)}
                              disabled={deliveryUpdating === dr._id}
                              className="p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Return to stock"
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          )}
                          {user?.role === 'Admin' && dr.status === 'issued' && (
                            <button
                              onClick={() => handleCancel(dr._id)}
                              disabled={cancelling === dr._id}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Cancel document"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleExportExcel(dr._id)}
                            className="p-2 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-500/20 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                            title="Download Excel"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(dr)}
                            disabled={dr.status !== 'draft'}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                            title={dr.status !== 'draft' ? 'Cannot edit issued/cancelled DR' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(dr._id)}
                            disabled={dr.status !== 'draft'}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                            title={dr.status !== 'draft' ? 'Cannot delete issued/cancelled DR' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={20}
              onPageChange={setPage}
              label="DRs"
            />
          </>
        )}
      </div>

      {/* Document Form Modal */}
      {formOpen && (
        <DocumentForm
          documentType="DR"
          initialData={editingDR}
          onSubmit={handleSubmit}
          onClose={() => { setFormOpen(false); setEditingDR(null); }}
          loading={submitting}
        />
      )}

      {/* Linked Sales Invoice Form Modal */}
      {linkedSI && (
        <DocumentForm
          documentType="SI"
          initialData={linkedSI}
          onSubmit={handleLinkedSISubmit}
          onClose={() => setLinkedSI(null)}
          loading={submitting}
        />
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreview
          document={previewDoc.doc}
          documentType={previewDoc.type}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Success "pop" (Feature 35) */}
      {showPop && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-scale-in bg-green-500 text-white rounded-full p-3 shadow-lg pointer-events-none dark:bg-emerald-500">
          <CheckCircle className="w-6 h-6" />
        </div>
      )}
    </div>
  );
};

export default DeliveryReceipts;