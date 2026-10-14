import React, { useState, useEffect } from 'react';
import { Plus, Loader, FileText, Edit, Trash2, Eye, AlertTriangle, CheckCircle, User, XCircle, FileOutput } from 'lucide-react';
import { efApi } from '../api/ef';
import { drsiApi } from '../api/drsi';
import DocumentForm from '../components/drsi/DocumentForm';
import DocumentPreview from '../components/drsi/DocumentPreview';
import { formatDate, formatCurrency, numberToWords } from '../utils/numberToWords';
import { useToast } from '../components/Toast';
import { Pagination, StatusBadge, EmptyState, ListToolbar } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EvaluationForms = ({ user }) => {
  const [efs, setEFs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEF, setEditingEF] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [linkedDR, setLinkedDR] = useState(null);

  const { toast, confirmDialog, promptDialog } = useToast();

  const debouncedSearch = useDebounce(search, 400);

  const fetchEFs = async () => {
    setLoading(true);
    try {
      const response = await efApi.getEFs({
        search: debouncedSearch,
        status: statusFilter,
        page,
        limit: 20
      });
      setEFs(response.data.efs);
      setTotal(response.data.total);
      setTotalPages(response.data.pages);
    } catch (err) {
      console.error('Failed to fetch EFs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEFs();
  }, [debouncedSearch, statusFilter, page]);

  const handleSubmit = async (data, action) => {
    setSubmitting(true);
    try {
      let docId;
      if (editingEF) {
        await efApi.updateEF(editingEF._id, data);
        docId = editingEF._id;
      } else {
        const response = await efApi.createEF(data);
        docId = response.data._id;
      }

      if (action === 'issue') {
        await efApi.issueEF(docId);
      }

      setFormOpen(false);
      setEditingEF(null);
      fetchEFs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ef) => {
    setPreviewDoc(null);
    setLinkedDR(null);
    setEditingEF(ef);
    setFormOpen(true);
  };

  const handleNew = () => {
    setPreviewDoc(null);
    setLinkedDR(null);
    setEditingEF(null);
    setFormOpen(true);
  };

  const openPreview = (doc, type) => {
    setFormOpen(false);
    setEditingEF(null);
    setLinkedDR(null);
    setPreviewDoc({ doc, type });
  };

  const handleOpenLinkedDR = async (ef) => {
    try {
      const res = await drsiApi.getDRs({ efRef: ef._id });
      const dr = res.data.drs?.[0];
      if (!dr) {
        toast.info('No linked delivery receipt');
        return;
      }
      if (dr.status === 'draft') {
        setPreviewDoc(null);
        setFormOpen(false);
        setEditingEF(null);
        setLinkedDR(dr);
      } else {
        openPreview(dr, 'DR');
      }
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleLinkedDRSubmit = async (data, action) => {
    setSubmitting(true);
    try {
      await drsiApi.updateDR(linkedDR._id, data);
      if (action === 'issue') await drsiApi.issueDR(linkedDR._id);
      setLinkedDR(null);
      toast.success(action === 'issue' ? 'Delivery receipt issued' : 'Delivery receipt updated');
      fetchEFs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const sure = await confirmDialog('Delete this Evaluation Form?', { title: 'Delete Document', danger: true, confirmText: 'Delete' });
    if (!sure) return;
    try {
      await efApi.deleteEF(id);
      fetchEFs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancel = async (id) => {
    const reason = await promptDialog('Enter cancellation reason:', { title: 'Cancel Document' });
    if (!reason || !reason.trim()) return;
    const sure = await confirmDialog('Cancel this evaluation form? Its linked delivery receipt draft (and its invoice draft) will also be cancelled. This cannot be undone.', { title: 'Cancel Document', danger: true, confirmText: 'Cancel Document' });
    if (!sure) return;
    setCancelling(id);
    try {
      await efApi.cancelEF(id, reason.trim());
      toast.success('Document cancelled');
      fetchEFs();
    } catch (err) {
      toast.error('Cancel failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setCancelling(null);
    }
  };

  const handleExportExcel = async (id) => {
    try {
      const response = await efApi.exportEF(id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ef = efs.find(e => e._id === id);
      link.download = `${ef?.efNumber || 'EF'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const getStatusBadge = (status) => <StatusBadge status={status} />;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center space-x-3">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
            <span>Evaluation Forms</span>
          </h1>
          <p className="mt-1 text-gray-600 dark:text-slate-400">Manage evaluation forms and generate delivery receipts</p>
        </div>
        <button onClick={handleNew} className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] min-w-[140px]">
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New EF</span>
        </button>
      </div>

      {/* Search & Filter */}
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by EF number or customer..."
        status={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
        statusOptions={STATUS_OPTIONS}
      />

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin text-primary dark:text-blue-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-slate-400">Loading evaluation forms...</p>
          </div>
        ) : efs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No evaluation forms found"
            action={
              <button onClick={handleNew} className="text-primary dark:text-blue-400 hover:underline touch-manipulation min-h-[44px]">Create your first EF</button>
            }
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-200 dark:divide-slate-800">
                {efs.map((ef) => (
                  <div key={ef._id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate font-mono">{ef.efNumber}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{ef.customerName}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        {getStatusBadge(ef.status)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Date</p>
                        <p className="font-medium">{formatDate(ef.date)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Items</p>
                        <p className="font-medium">{ef.items?.length || 0} items</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Requested By</p>
                        <p className="font-medium flex items-center space-x-1">
                          {ef.marketingExecutive ? (
                            <>
                              <User className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                              <span>{ef.marketingExecutive.name || ef.marketingExecutive}</span>
                            </>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">—</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Total</p>
                        <p className="font-medium text-right">{formatCurrency(ef.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-500">Created</p>
                        <p className="font-medium">{formatDate(ef.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openPreview(ef, 'EF')}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 touch-manipulation min-h-[44px] transition-colors"
                        title="Preview document"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-sm font-medium">View</span>
                      </button>
                      {(ef.status === 'issued' || ef.status === 'cancelled') && (
                        <button
                          onClick={() => handleOpenLinkedDR(ef)}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/30 touch-manipulation min-h-[44px] transition-colors"
                          title="Open linked delivery receipt"
                        >
                          <FileOutput className="w-4 h-4" />
                          <span className="text-sm font-medium">DR</span>
                        </button>
                      )}
                      {user?.role === 'Admin' && ef.status === 'issued' && (
                        <button
                          onClick={() => handleCancel(ef._id)}
                          disabled={cancelling === ef._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                          title="Cancel document"
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Cancel</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleExportExcel(ef._id)}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-green-50 dark:bg-emerald-500/15 text-green-700 dark:text-emerald-400 rounded-lg hover:bg-green-100 dark:hover:bg-emerald-500/30 touch-manipulation min-h-[44px] transition-colors"
                        title="Download Excel"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">Excel</span>
                      </button>
                      <button
                        onClick={() => handleEdit(ef)}
                        disabled={ef.status !== 'draft'}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title={ef.status !== 'draft' ? 'Cannot edit issued/cancelled EF' : 'Edit'}
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(ef._id)}
                        disabled={ef.status !== 'draft'}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/30 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title={ef.status !== 'draft' ? 'Cannot delete issued/cancelled EF' : 'Delete'}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">EF Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {efs.map((ef) => (
                    <tr key={ef._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 dark:text-slate-100">{ef.efNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{formatDate(ef.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{ef.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 flex items-center space-x-1">
                        {ef.marketingExecutive ? (
                          <>
                            <User className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                            <span>{ef.marketingExecutive.name || ef.marketingExecutive}</span>
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{ef.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 text-right">{formatCurrency(ef.totalAmount)}</td>
                      <td className="px-4 py-3">{getStatusBadge(ef.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(ef.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 justify-end">
                          <button
                            onClick={() => openPreview(ef, 'EF')}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(ef.status === 'issued' || ef.status === 'cancelled') && (
                            <button
                              onClick={() => handleOpenLinkedDR(ef)}
                              className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Open linked delivery receipt"
                            >
                              <FileOutput className="w-4 h-4" />
                            </button>
                          )}
                          {user?.role === 'Admin' && ef.status === 'issued' && (
                            <button
                              onClick={() => handleCancel(ef._id)}
                              disabled={cancelling === ef._id}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Cancel document"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleExportExcel(ef._id)}
                            className="p-2 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-500/15 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                            title="Download Excel"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(ef)}
                            disabled={ef.status !== 'draft'}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                            title={ef.status !== 'draft' ? 'Cannot edit issued/cancelled EF' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ef._id)}
                            disabled={ef.status !== 'draft'}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                            title={ef.status !== 'draft' ? 'Cannot delete issued/cancelled EF' : 'Delete'}
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
              label="EFs"
            />
          </>
        )}
      </div>

      {/* Document Form Modal */}
      {formOpen && (
        <DocumentForm
          documentType="EF"
          initialData={editingEF}
          onSubmit={handleSubmit}
          onClose={() => { setFormOpen(false); setEditingEF(null); }}
          loading={submitting}
        />
      )}

      {/* Linked Delivery Receipt Form Modal */}
      {linkedDR && (
        <DocumentForm
          documentType="DR"
          initialData={linkedDR}
          onSubmit={handleLinkedDRSubmit}
          onClose={() => setLinkedDR(null)}
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
    </div>
  );
};

export default EvaluationForms;
