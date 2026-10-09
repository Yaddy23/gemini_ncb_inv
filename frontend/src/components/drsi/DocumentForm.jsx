import React, { useState, useEffect } from 'react';
import { Loader, FileText, Download, Printer, X, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import LineItemsTable from './LineItemsTable';
import { formatDate, formatDateInput } from '../../utils/numberToWords';
import api from '../../api/axios';

const DocumentForm = ({
  documentType, // 'DR', 'SI', or 'EF'
  initialData,
  onSubmit,
  onClose,
  loading,
  exporting
}) => {
  const isDR = documentType === 'DR';
  const isEF = documentType === 'EF';
  const title = isDR ? 'Delivery Receipt' : isEF ? 'Entry Form' : 'Sales Invoice';
  const numberLabel = isDR ? 'DR Number' : isEF ? 'EF Number' : 'SI Number';

  const [formData, setFormData] = useState({
    documentNumber: '',
    date: formatDateInput(new Date()),
    customerName: '',
    customerAddress: '',
    poNumber: '',
    discountPercentage: 0,
    items: [{ isbn: '', title: '', qty: 1, unitPrice: 0, amount: 0 }]
  });

  const [errors, setErrors] = useState({});
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, duplicates: [], action: null, payload: null });

  useEffect(() => {
    if (initialData) {
      setFormData({
        documentNumber: initialData.drNumber || initialData.siNumber || initialData.efNumber || '',
        date: initialData.date ? formatDateInput(initialData.date) : formatDateInput(new Date()),
        customerName: initialData.customerName || '',
        customerAddress: initialData.customerAddress || '',
        poNumber: initialData.poNumber || '',
        discountPercentage: initialData.discountPercentage || 0,
        items: initialData.items?.length ? initialData.items : [{ isbn: '', title: '', qty: 1, unitPrice: 0, amount: 0 }]
      });
    }
  }, [initialData]);

  // Helper function to check for duplicate ISBNs
  const checkDuplicateISBNs = (items) => {
    const isbnCounts = {};
    const duplicates = [];

    items.forEach((item, index) => {
      const isbn = item.isbn?.trim();
      if (isbn) {
        if (isbnCounts[isbn] === undefined) {
          isbnCounts[isbn] = { count: 1, indices: [index] };
        } else {
          isbnCounts[isbn].count++;
          isbnCounts[isbn].indices.push(index);
        }
      }
    });

    for (const [isbn, data] of Object.entries(isbnCounts)) {
      if (data.count > 1) {
        duplicates.push({
          isbn,
          count: data.count,
          indices: data.indices
        });
      }
    }

    return duplicates;
  };

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

    // Filter items with ISBN
    const validItems = formData.items.filter(item => item.isbn.trim());

    // Check for duplicate ISBNs
    const duplicates = checkDuplicateISBNs(validItems);
    if (duplicates.length > 0) {
      // Show confirmation dialog
      setDuplicateDialog({
        open: true,
        duplicates: duplicates.map(d => ({
          isbn: d.isbn,
          count: d.count,
          lineNumbers: d.indices.map(i => i + 1)
        })),
        action,
        payload: {
          ...(isDR ? { drNumber: formData.documentNumber } : isEF ? { efNumber: formData.documentNumber } : { siNumber: formData.documentNumber }),
          date: formData.date,
          customerName: formData.customerName,
          customerAddress: formData.customerAddress,
          items: validItems.map(item => ({
            isbn: item.isbn,
            title: item.title,
            qty: item.qty,
            unitPrice: item.unitPrice,
            amount: item.amount
          }))
        }
      });
      return;
    }

    // No duplicates, proceed with submit
    submitForm(action, { ...(isDR ? { drNumber: formData.documentNumber } : isEF ? { efNumber: formData.documentNumber } : { siNumber: formData.documentNumber }), date: formData.date, customerName: formData.customerName, customerAddress: formData.customerAddress, items: validItems.map(item => ({ isbn: item.isbn, title: item.title, qty: item.qty, unitPrice: item.unitPrice, amount: item.amount })) });
  };

  const submitForm = (action, payload, allowDuplicates = false) => {
    if (!isDR && !isEF) {
      payload.poNumber = formData.poNumber;
      payload.discountPercentage = formData.discountPercentage;
    }
    payload.allowDuplicates = allowDuplicates;
    onSubmit(payload, action);
  };

  const handleExport = async (format) => {
    if (!initialData?._id) return alert('Save document first before exporting');
    try {
      let url;
      if (isDR) {
        url = `/drsi/dr/${initialData._id}/export?format=${format}`;
      } else if (isEF) {
        url = `/ef/${initialData._id}/export?format=${format}`;
      } else {
        url = `/drsi/si/${initialData._id}/export?format=${format}`;
      }

      const response = await api.get(url, { responseType: 'blob' });

      const blob = response.data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${formData.documentNumber}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      const message = err.response?.data?.message || err.message || 'Export failed';
      alert('Export failed: ' + message);
    }
  };

  // Handle duplicate ISBN dialog actions
  const handleDuplicateConfirm = (removeDuplicates) => {
    if (!duplicateDialog.payload || !duplicateDialog.action) return;

    if (removeDuplicates) {
      // Remove duplicate ISBNs - keep only first occurrence
      const seenISBNs = new Set();
      const uniqueItems = duplicateDialog.payload.items.filter(item => {
        const isbn = item.isbn.trim();
        if (seenISBNs.has(isbn)) {
          return false;
        }
        seenISBNs.add(isbn);
        return true;
      });

      submitForm(duplicateDialog.action, { ...duplicateDialog.payload, items: uniqueItems }, false);
    } else {
      // Proceed with duplicates
      submitForm(duplicateDialog.action, duplicateDialog.payload, true);
    }

    setDuplicateDialog({ open: false, duplicates: [], action: null, payload: null });
  };

  // Render duplicate ISBN confirmation dialog
  const DuplicateDialog = () => {
    if (!duplicateDialog.open) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setDuplicateDialog({ open: false, duplicates: [], action: null, payload: null })}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative mx-auto mt-20 w-full max-w-md bg-white rounded-xl shadow-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Duplicate ISBNs Detected</h3>
          </div>

          <p className="text-gray-600 mb-4">The following ISBNs appear multiple times in your line items:</p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
            {duplicateDialog.duplicates.map((dup, index) => (
              <div key={index} className="mb-3 last:mb-0">
                <p className="font-medium text-gray-900">ISBN: {dup.isbn}</p>
                <p className="text-sm text-gray-600">
                  Appears {dup.count} time{dup.count > 1 ? 's' : ''} (line{dup.count > 1 ? 's' : ''}: {dup.lineNumbers.join(', ')})
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-600 mb-6">How would you like to proceed?</p>

          <div className="flex space-x-3 justify-end">
            <button
              onClick={() => setDuplicateDialog({ open: false, duplicates: [], action: null, payload: null })}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDuplicateConfirm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              Remove Duplicates
            </button>
            <button
              onClick={() => handleDuplicateConfirm(false)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Proceed Anyway
            </button>
          </div>
        </div>
      </div>
    );
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
                placeholder={isDR ? 'DR-20240101-001' : isEF ? 'EF-20240101-001' : 'SI-20240101-001'}
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
            {!isDR && !isEF && (
              <>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountPercentage: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
                    disabled={loading}
                  />
                </div>
              </>
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
            maxRows={300}
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
      {/* Duplicate ISBN Dialog */}
      <DuplicateDialog />
    </div>
  );
};

export default DocumentForm;