import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader, FileText, Download, Printer, Edit, Trash2, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { efApi } from '../api/ef';
import DocumentForm from '../components/drsi/DocumentForm';
import { formatDate, formatCurrency, numberToWords } from '../utils/numberToWords';

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
  const [exporting, setExporting] = useState(null);

  const fetchEFs = async () => {
    setLoading(true);
    try {
      const response = await efApi.getEFs({
        search,
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
  }, [search, statusFilter, page]);

  const handleSubmit = async (data, action) => {
    setSubmitting(true);
    try {
      if (editingEF) {
        await efApi.updateEF(editingEF._id, data);
      } else {
        await efApi.createEF(data);
      }

      if (action === 'issue' && !editingEF) {
        // For new EFs, we need to create then issue
        const response = await efApi.createEF(data);
        await efApi.issueEF(response.data._id);
      } else if (action === 'issue' && editingEF) {
        await efApi.updateEF(editingEF._id, data);
        await efApi.issueEF(editingEF._id);
      }

      setFormOpen(false);
      setEditingEF(null);
      fetchEFs();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ef) => {
    setEditingEF(ef);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingEF(null);
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Evaluation Form?')) return;
    try {
      await efApi.deleteEF(id);
      fetchEFs();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExport = async (id, format) => {
    setExporting(id);
    try {
      const response = await efApi.exportEF(id, format);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ef = efs.find(e => e._id === id);
      link.download = `${ef?.efNumber || 'EF'}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
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
            <span>Evaluation Forms</span>
          </h1>
          <p className="mt-1 text-gray-600">Manage evaluation forms and generate delivery receipts</p>
        </div>
        <button onClick={handleNew} className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span>New EF</span>
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
              placeholder="Search by EF number or customer..."
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
            <p className="text-gray-500">Loading evaluation forms...</p>
          </div>
        ) : efs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No evaluation forms found</p>
            <button onClick={handleNew} className="mt-4 text-primary hover:underline">Create your first EF</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">EF Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DR Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {efs.map((ef) => (
                    <tr key={ef._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{ef.efNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(ef.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{ef.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{ef.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(ef.totalAmount)}</td>
                      <td className="px-4 py-3">{getStatusBadge(ef.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ef.drRef ? ef.drRef.drNumber : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(ef.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 justify-end">
                          <button
                            onClick={() => handleExport(ef._id, 'xlsx')}
                            disabled={exporting === ef._id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Download Excel"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExport(ef._id, 'pdf')}
                            disabled={exporting === ef._id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Download PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(ef)}
                            disabled={ef.status === 'issued'}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                            title={ef.status === 'issued' ? 'Cannot edit issued EF' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ef._id)}
                            disabled={ef.status === 'issued'}
                            className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title={ef.status === 'issued' ? 'Cannot delete issued EF' : 'Delete'}
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
                  Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} EFs
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
          documentType="EF"
          initialData={editingEF}
          onSubmit={handleSubmit}
          onClose={() => { setFormOpen(false); setEditingEF(null); }}
          loading={submitting}
          exporting={exporting}
        />
      )}
    </div>
  );
};

export default EvaluationForms;