import React, { useState, useEffect } from 'react';
import { Loader, FileText, Download, Printer, X } from 'lucide-react';
import LineItemsTable from './LineItemsTable';
import { formatDate, formatDateInput } from '../../utils/numberToWords';

const DocumentForm = ({
  documentType, // 'DR' or 'SI'
  initialData,
  onSubmit,
  onClose,
  loading,
  exporting
}) => {
  const isDR = documentType === 'DR';
  const title = isDR ? 'Delivery Receipt' : 'Sales Invoice';
  const numberLabel = isDR ? 'DR Number' : 'SI Number';

  const [formData, setFormData] = useState({
    documentNumber: '',
    date: formatDateInput(new Date()),
    customerName: '',
    customerAddress: '',
    poNumber: '',
    items: [{ isbn: '', title: '', qty: 1, unitPrice: 0, amount: 0 }]
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        documentNumber: initialData.drNumber || initialData.siNumber || '',
        date: initialData.date ? formatDateInput(initialData.date) : formatDateInput(new Date()),
        customerName: initialData.customerName || '',
        customerAddress: initialData.customerAddress || '',
        poNumber: initialData.poNumber || '',
        items: initialData.items?.length ? initialData.items : [{ isbn: '', title: '', qty: 1, unitPrice: 0, amount: 0 }]
      });
    }
  }, [initialData]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.documentNumber.trim()) newErrors.documentNumber = `${numberLabel} is required`;
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer Name is required';
    if (!formData.items.some(item => item.isbn.trim())) newErrors.items = 'At least one item with ISBN is required';

    // Check for items without title (failed lookup)
    const itemsWithoutTitle = formData.items.filter(item => item.isbn.trim() && !item.title.trim());
    if (itemsWithoutTitle.length > 0) {
      newErrors.items = 'Some items have invalid ISBNs (book not found)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (action) => {
    if (!validateForm()) return;

    const payload = {
      ...(isDR ? { drNumber: formData.documentNumber } : { siNumber: formData.documentNumber }),
      date: formData.date,
      customerName: formData.customerName,
      customerAddress: formData.customerAddress,
      items: formData.items.filter(item => item.isbn.trim()).map(item => ({
        isbn: item.isbn,
        title: item.title,
        qty: item.qty,
        unitPrice: item.unitPrice,
        amount: item.amount
      }))
    };

    if (!isDR) {
      payload.poNumber = formData.poNumber;
    }

    onSubmit(payload, action);
  };

  const handleExport = async (format) => {
    if (!initialData?._id) return alert('Save document first before exporting');
    try {
      const response = isDR
        ? await fetch(`/api/drsi/dr/${initialData._id}/export?format=${format}`)
        : await fetch(`/api/drsi/si/${initialData._id}/export?format=${format}`);

      console.log('Export response:', response.status, response.statusText);

      if (!response.ok) {
        const text = await response.text();
        console.log('Export error response body:', text);
        let errorData = { message: text || 'Unknown error' };
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          // Not JSON, use raw text
        }
        throw new Error(errorData.message || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formData.documentNumber}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-auto mt-10 w-full max-w-5xl bg-white rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <FileText className="w-6 h-6 text-primary" />
            <span>{title} {initialData ? 'Edit' : 'New'}</span>
          </h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{numberLabel} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.documentNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, documentNumber: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.documentNumber ? 'border-red-500' : 'border-gray-300'}`}
                placeholder={isDR ? 'DR-20240101-001' : 'SI-20240101-001'}
                disabled={loading}
              />
              {errors.documentNumber && <p className="mt-1 text-sm text-red-500">{errors.documentNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.customerName ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Customer name"
                disabled={loading}
              />
              {errors.customerName && <p className="mt-1 text-sm text-red-500">{errors.customerName}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Address</label>
              <textarea
                value={formData.customerAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>
            {!isDR && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">P.O. Number</label>
                <input
                  type="text"
                  value={formData.poNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, poNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Purchase Order #"
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {errors.items && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errors.items}</span>
            </div>
          )}

          {/* Line Items */}
          <LineItemsTable
            items={formData.items}
            onItemsChange={(items) => setFormData(prev => ({ ...prev, items }))}
            documentType={documentType}
            maxRows={isDR ? 39 : 28}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center space-x-2 ml-auto">
            {initialData && !loading && !exporting && (
              <>
                <button
                  onClick={() => handleExport('xlsx')}
                  disabled={exporting}
                  className="flex items-center space-x-1 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                  title="Download Excel"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Excel</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  className="flex items-center space-x-1 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  title="Download PDF"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">PDF</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit('draft')}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSubmit('issue')}
              disabled={loading || formData.status === 'issued'}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Issue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentForm;