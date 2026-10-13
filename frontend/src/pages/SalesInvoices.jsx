import React, { useState, useEffect } from 'react';
import { Plus, Loader, FileText, Edit, Trash2, Eye, User, XCircle } from 'lucide-react';
import { drsiApi } from '../api/drsi';
import DocumentForm from '../components/drsi/DocumentForm';
import DocumentPreview from '../components/drsi/DocumentPreview';
import { formatDate, formatCurrency } from '../utils/numberToWords';
import { useToast } from '../components/Toast';
import { Pagination, StatusBadge, EmptyState, ListToolbar } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SalesInvoices = ({ user }) => {
  const [sis, setSIs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSI, setEditingSI] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const { toast, confirmDialog, promptDialog } = useToast();

  const debouncedSearch = useDebounce(search, 400);

  const fetchSIs = async () => {
    setLoading(true);
    try {
      const response = await drsiApi.getSIs({
        search: debouncedSearch,
        status: statusFilter,
        page,
        limit: 20
      });
      setSIs(response.data.sis);
      setTotal(response.data.total);
      setTotalPages(response.data.pages);
    } catch (err) {
      console.error('Failed to fetch SIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSIs();
  }, [debouncedSearch, statusFilter, page]);

  const handleSubmit = async (data, action) => {
    setSubmitting(true);
    try {
      let docId;
      if (editingSI) {
        await drsiApi.updateSI(editingSI._id, data);
        docId = editingSI._id;
      } else {
        const response = await drsiApi.createSI(data);
        docId = response.data._id;
      }

      if (action === 'issue') {
        await drsiApi.issueSI(docId);
      }

      setFormOpen(false);
      setEditingSI(null);
      fetchSIs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (si) => {
    setPreviewDoc(null);
    setEditingSI(si);
    setFormOpen(true);
  };

  const handleNew = () => {
    setPreviewDoc(null);
    setEditingSI(null);
    setFormOpen(true);
  };

  const openPreview = (doc, type) => {
    setFormOpen(false);
    setEditingSI(null);
    setPreviewDoc({ doc, type });
  };

  const handleDelete = async (id) => {
    const sure = await confirmDialog('Delete this Sales Invoice?', { title: 'Delete Document', danger: true, confirmText: 'Delete' });
    if (!sure) return;
    try {
      await drsiApi.deleteSI(id);
      fetchSIs();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancel = async (id) => {
    const reason = await promptDialog('Enter cancellation reason:', { title: 'Cancel Document' });
    if (!reason || !reason.trim()) return;
    const sure = await confirmDialog('Cancel this sales invoice? This cannot be undone.', { title: 'Cancel Document', danger: true, confirmText: 'Cancel Document' });
    if (!sure) return;
    setCancelling(id);
    try {
      await drsiApi.cancelSI(id, reason.trim());
      toast.success('Document cancelled');
      fetchSIs();
    } catch (err) {
      toast.error('Cancel failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setCancelling(null);
    }
  };

  const handleExportExcel = async (id) => {
    try {
      const response = await drsiApi.exportSI(id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const si = sis.find(s => s._id === id);
      link.download = `${si?.siNumber || 'SI'}.xlsx`;
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center space-x-3">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span>Sales Invoices</span>
          </h1>
          <p className="mt-1 text-gray-600">Manage sales invoices (linked from Delivery Receipts)</p>
        </div>
        <button onClick={handleNew} className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] min-w-[140px]">
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New SI</span>
        </button>
      </div>

      {/* Search & Filter */}
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by SI number or customer..."
        status={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
        statusOptions={STATUS_OPTIONS}
      />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-gray-500">Loading sales invoices...</p>
          </div>
        ) : sis.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No sales invoices found"
            action={
              <button onClick={handleNew} className="text-primary hover:underline touch-manipulation min-h-[44px]">Create your first SI</button>
            }
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-200">
                {sis.map((si) => (
                  <div key={si._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate font-mono">{si.siNumber}</h3>
                        <p className="text-sm text-gray-500 truncate">{si.customerName}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        {getStatusBadge(si.status)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-400">Date</p>
                        <p className="font-medium">{formatDate(si.date)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Items</p>
                        <p className="font-medium">{si.items?.length || 0} items</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Requested By</p>
                        <p className="font-medium flex items-center space-x-1">
                          {si.marketingExecutive ? (
                            <>
                              <User className="w-3 h-3 text-gray-400" />
                              <span>{si.marketingExecutive.name || si.marketingExecutive}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">P.O. #</p>
                        <p className="font-medium font-mono">{si.poNumber || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Ref DR</p>
                        <p className="font-medium">{si.drRef?.drNumber || (si.drRef ? 'Linked' : '—')}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total</p>
                        <p className="font-medium text-right">{formatCurrency(si.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Created</p>
                        <p className="font-medium">{formatDate(si.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openPreview(si, 'SI')}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 touch-manipulation min-h-[44px] transition-colors"
                        title="Preview document"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-sm font-medium">View</span>
                      </button>
                      {user?.role === 'Admin' && si.status === 'issued' && (
                        <button
                          onClick={() => handleCancel(si._id)}
                          disabled={cancelling === si._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                          title="Cancel document"
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Cancel</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleExportExcel(si._id)}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 touch-manipulation min-h-[44px] transition-colors"
                        title="Download Excel"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">Excel</span>
                      </button>
                      <button
                        onClick={() => handleEdit(si)}
                        disabled={si.status !== 'draft'}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title={si.status !== 'draft' ? 'Cannot edit issued/cancelled SI' : 'Edit'}
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(si._id)}
                        disabled={si.status !== 'draft'}
                        className="flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                        title={si.status !== 'draft' ? 'Cannot delete issued/cancelled SI' : 'Delete'}
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SI Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">P.O. #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref DR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sis.map((si) => (
                    <tr key={si._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{si.siNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(si.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{si.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 flex items-center space-x-1">
                        {si.marketingExecutive ? (
                          <>
                            <User className="w-3 h-3 text-gray-400" />
                            <span>{si.marketingExecutive.name || si.marketingExecutive}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{si.poNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {si.drRef?.drNumber || (si.drRef ? 'Linked' : '—')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{si.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(si.totalAmount)}</td>
                      <td className="px-4 py-3">{getStatusBadge(si.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(si.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 justify-end">
                          <button
                            onClick={() => openPreview(si, 'SI')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {user?.role === 'Admin' && si.status === 'issued' && (
                            <button
                              onClick={() => handleCancel(si._id)}
                              disabled={cancelling === si._id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                              title="Cancel document"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleExportExcel(si._id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded touch-manipulation min-h-[44px] min-w-[44px]"
                            title="Download Excel"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(si)}
                            disabled={si.status !== 'draft'}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                            title={si.status !== 'draft' ? 'Cannot edit issued/cancelled SI' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(si._id)}
                            disabled={si.status !== 'draft'}
                            className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 touch-manipulation min-h-[44px] min-w-[44px]"
                            title={si.status !== 'draft' ? 'Cannot delete issued/cancelled SI' : 'Delete'}
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
              label="SIs"
            />
          </>
        )}
      </div>

      {/* Document Form Modal */}
      {formOpen && (
        <DocumentForm
          documentType="SI"
          initialData={editingSI}
          onSubmit={handleSubmit}
          onClose={() => { setFormOpen(false); setEditingSI(null); }}
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

export default SalesInvoices;