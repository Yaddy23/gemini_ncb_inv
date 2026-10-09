import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader, FileText, Download, Printer, Edit, Trash2, Eye, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { drsiApi } from '../api/drsi';
import DocumentForm from '../components/drsi/DocumentForm';
import { formatDate, formatCurrency, numberToWords } from '../utils/numberToWords';

const DeliveryReceipts = ({ user }) => {
  const [drs, setDRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDR, setEditingDR] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(null);

  const fetchDRs = async () => {
    setLoading(true);
    try {
      const response = await drsiApi.getDRs({
        search,
        status: statusFilter,
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
  }, [search, statusFilter, page]);

  const handleSubmit = async (data, action) => {
    setSubmitting(true);
    try {
      if (editingDR) {
        await drsiApi.updateDR(editingDR._id, data);
      } else {
        await drsiApi.createDR(data);
      }

      if (action === 'issue' && !editingDR) {
        // For new DRs, we need to create then issue
        const response = await drsiApi.createDR(data);
        await drsiApi.issueDR(response.data._id);
      } else if (action === 'issue' && editingDR) {
        await drsiApi.updateDR(editingDR._id, data);
        await drsiApi.issueDR(editingDR._id);
      }

      setFormOpen(false);
      setEditingDR(null);
      fetchDRs();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dr) => {
    setEditingDR(dr);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingDR(null);
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Delivery Receipt?')) return;
    try {
      await drsiApi.deleteDR(id);
      fetchDRs();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExport = async (id, format) => {
    setExporting(id);
    try {
      const response = await drsiApi.exportDR(id, format);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dr = drs.find(d => d._id === id);
      link.download = `${dr?.drNumber || 'DR'}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'issued') {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Issued</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Draft</span>;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary" />
            <span>Delivery Receipts</span>
          </h1>
          <p className="mt-1 text-gray-600">Manage delivery receipts and generate sales invoices</p>
        </div>
        <button onClick={handleNew} className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span>New DR</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by DR number or customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-gray-500">Loading delivery receipts...</p>
          </div>
        ) : drs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No delivery receipts found</p>
            <button onClick={handleNew} className="mt-4 text-primary hover:underline">Create your first DR</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DR Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">EF Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {drs.map((dr) => (
                    <tr key={dr._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{dr.drNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(dr.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{dr.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 flex items-center space-x-1">
                        {dr.marketingExecutive ? (
                          <>
                            <User className="w-3 h-3 text-gray-400" />
                            <span>{dr.marketingExecutive.name || dr.marketingExecutive}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{dr.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(dr.totalAmount)}</td>
                      <td className="px-4 py-3">{getStatusBadge(dr.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {dr.efRef ? dr.efRef.efNumber : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(dr.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 justify-end">
                          <button
                            onClick={() => handleExport(dr._id, 'xlsx')}
                            disabled={exporting === dr._id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Download Excel"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExport(dr._id, 'pdf')}
                            disabled={exporting === dr._id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Download PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(dr)}
                            disabled={dr.status === 'issued'}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                            title={dr.status === 'issued' ? 'Cannot edit issued DR' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(dr._id)}
                            disabled={dr.status === 'issued'}
                            className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title={dr.status === 'issued' ? 'Cannot delete issued DR' : 'Delete'}
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
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} DRs
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
          exporting={exporting}
        />
      )}
    </div>
  );
};

export default DeliveryReceipts;