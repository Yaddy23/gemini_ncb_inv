import React, { useState, useEffect, useRef } from 'react';
import { Loader, FileText, X, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import LineItemsTable from './LineItemsTable';
import CustomerAutocomplete from './CustomerAutocomplete';
import { formatDate, formatDateInput } from '../../utils/numberToWords';
import api from '../../api/axios';
import { useToast } from '../Toast';
import { Modal, Button } from '../ui';

// A draft is only worth keeping if it has meaningful content
// (avoids junk drafts from casually opening the modal)
const hasDraftContent = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (data.documentNumber?.trim() || data.customerName?.trim() || data.customerAddress?.trim()) return true;
  const items = Array.isArray(data.items) ? data.items : [];
  return items.some(item => item?.isbn?.trim() || item?.title?.trim());
};

const DocumentForm = ({
  documentType, // 'DR', 'SI', or 'EF'
  initialData,
  onSubmit,
  onClose,
  loading
}) => {
  const isDR = documentType === 'DR';
  const isEF = documentType === 'EF';
  const title = isDR ? 'Delivery Receipt' : isEF ? 'Evaluation Form' : 'Sales Invoice';
  const numberLabel = isDR ? 'DR Number' : isEF ? 'EF Number' : 'SI Number';

  const { toast, confirmDialog } = useToast();

  const [formData, setFormData] = useState({
    documentNumber: '',
    date: formatDateInput(new Date()),
    customerName: '',
    customerAddress: '',
    marketingExecutive: '',
    poNumber: '',
    discountPercentage: 0,
    items: [{ isbn: '', title: '', qty: 1, unitPrice: 0, amount: 0 }]
  });

  const [errors, setErrors] = useState({});
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, duplicates: [], action: null, payload: null });
  const [marketingExecutives, setMarketingExecutives] = useState([]);
  const [loadingExecutives, setLoadingExecutives] = useState(false);

  // Draft autosave (new documents only) - one draft per document type
  const draftKey = `docform-draft-${documentType}`;
  const autosaveTimerRef = useRef(null);
  const submittedRef = useRef(false);
  // Baseline snapshot of initialData fields, used to detect unsaved changes while editing
  const baselineRef = useRef(null);

  // Fetch active marketing executives for dropdown
  useEffect(() => {
    const fetchExecutives = async () => {
      setLoadingExecutives(true);
      try {
        const response = await api.get('/marketing-executives/active');
        setMarketingExecutives(response.data);
      } catch (err) {
        console.error('Failed to fetch marketing executives:', err);
      } finally {
        setLoadingExecutives(false);
      }
    };
    fetchExecutives();
  }, []);

  useEffect(() => {
    if (initialData) {
      const mapped = {
        documentNumber: initialData.drNumber || initialData.siNumber || initialData.efNumber || '',
        date: initialData.date ? formatDateInput(initialData.date) : '',
        customerName: initialData.customerName || '',
        customerAddress: initialData.customerAddress || '',
        marketingExecutive: initialData.marketingExecutive?._id || initialData.marketingExecutive || '',
        poNumber: initialData.poNumber || '',
        discountPercentage: initialData.discountPercentage || 0,
        items: initialData.items?.length ? initialData.items : [{ isbn: '', title: '', qty: 1, unitPrice: 0, amount: 0 }]
      };
      setFormData(mapped);
      baselineRef.current = JSON.stringify(mapped);
    }
  }, [initialData]);

  // Debounced draft autosave for new documents - skips empty drafts
  useEffect(() => {
    if (initialData) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!hasDraftContent(formData)) return;
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      try {
        localStorage.setItem(draftKey, JSON.stringify(formData));
      } catch (err) {
        // Private mode / quota exceeded - fail silently
      }
    }, 500);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [formData, initialData, draftKey]);

  // On mount of a new document form, offer to restore a previously saved draft
  useEffect(() => {
    if (initialData) return;
    let storedDraft = null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) storedDraft = JSON.parse(raw);
    } catch (err) {
      storedDraft = null;
    }
    if (!hasDraftContent(storedDraft)) return;

    const offerRestore = async () => {
      const restore = await confirmDialog(`An unsaved ${title} draft was found. Restore it?`, { title: 'Unsaved Draft', confirmText: 'Restore' });
      if (restore) {
        setFormData(prev => ({
          ...prev,
          ...storedDraft,
          // Stock blocks are re-checked live on lookup, so don't restore stale flags
          items: Array.isArray(storedDraft.items)
            ? storedDraft.items.map(({ stockBlocked, ...item }) => item)
            : prev.items
        }));
      } else {
        try {
          localStorage.removeItem(draftKey);
        } catch (err) {
          // Fail silently
        }
      }
    };
    offerRestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On unmount, clear the draft if the form was submitted (parent unmounts after a successful save)
  useEffect(() => {
    return () => {
      if (submittedRef.current) {
        try {
          localStorage.removeItem(draftKey);
        } catch (err) {
          // Fail silently
        }
      }
    };
  }, [draftKey]);

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

    // Block items flagged as out of stock or fully reserved during lookup
    const blockedItems = formData.items.filter(item => item.isbn.trim() && item.stockBlocked);
    if (blockedItems.length > 0) {
      newErrors.items = 'Some items are out of stock or fully reserved and cannot be added';
    } else {
      // Check for items without title (failed lookup)
      const itemsWithoutTitle = formData.items.filter(item => item.isbn.trim() && !item.title.trim());
      if (itemsWithoutTitle.length > 0) {
        newErrors.items = 'Some items have invalid ISBNs (book not found)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (action) => {
    if (!validateForm()) return;

    // Filter items with ISBN (blocked items already fail validation, this is a safety net)
    const validItems = formData.items.filter(item => item.isbn.trim() && !item.stockBlocked);

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
          marketingExecutive: formData.marketingExecutive || null,
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
    submitForm(action, { ...(isDR ? { drNumber: formData.documentNumber } : isEF ? { efNumber: formData.documentNumber } : { siNumber: formData.documentNumber }), date: formData.date, customerName: formData.customerName, customerAddress: formData.customerAddress, marketingExecutive: formData.marketingExecutive || null, items: validItems.map(item => ({ isbn: item.isbn, title: item.title, qty: item.qty, unitPrice: item.unitPrice, amount: item.amount })) });
  };

  const submitForm = (action, payload, allowDuplicates = false) => {
    if (!isDR && !isEF) {
      payload.poNumber = formData.poNumber;
      payload.discountPercentage = formData.discountPercentage;
    }
    payload.allowDuplicates = allowDuplicates;
    submittedRef.current = true;
    onSubmit(payload, action);
  };

  // Close guard: while editing, confirm before discarding unsaved changes.
  // New documents keep their autosaved draft, so they close without prompting.
  const handleClose = async () => {
    if (loading) return;
    if (initialData && baselineRef.current !== null && JSON.stringify(formData) !== baselineRef.current) {
      const confirmed = await confirmDialog('You have unsaved changes. Close anyway?', { title: 'Unsaved Changes', danger: true, confirmText: 'Discard & Close' });
      if (!confirmed) return;
    }
    onClose();
  };

  const handleExport = async () => {
    if (!initialData?._id) {
      toast.error('Save document first before exporting');
      return;
    }
    try {
      let url;
      if (isDR) {
        url = `/drsi/dr/${initialData._id}/export`;
      } else if (isEF) {
        url = `/ef/${initialData._id}/export`;
      } else {
        url = `/drsi/si/${initialData._id}/export`;
      }

      const response = await api.get(url, { responseType: 'blob' });

      const blob = response.data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${formData.documentNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      const message = err.response?.data?.message || err.message || 'Export failed';
      toast.error('Export failed: ' + message);
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
    return (
      <Modal
        open={duplicateDialog.open}
        onClose={() => setDuplicateDialog({ open: false, duplicates: [], action: null, payload: null })}
        title={
          <span className="flex items-center space-x-3">
            <span className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </span>
            Duplicate ISBNs Detected
          </span>
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="touch" onClick={() => setDuplicateDialog({ open: false, duplicates: [], action: null, payload: null })}>
              Cancel
            </Button>
            <Button variant="danger" size="touch" onClick={() => handleDuplicateConfirm(true)}>
              <Trash2 className="w-4 h-4" />
              Remove Duplicates
            </Button>
            <Button variant="primary" size="touch" onClick={() => handleDuplicateConfirm(false)}>
              <CheckCircle className="w-4 h-4" />
              Proceed Anyway
            </Button>
          </>
        }
      >
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

        <p className="text-sm text-gray-600">How would you like to proceed?</p>
      </Modal>
    );
  };

  return (
    <>
      {/* Duplicate ISBN Dialog */}
      <DuplicateDialog />

      <Modal
        open
        onClose={handleClose}
        size="sheet"
        title={
          <span className="flex items-center space-x-2">
            <FileText className="w-6 h-6 text-primary" />
            <span>{title} {initialData ? 'Edit' : 'New'}</span>
          </span>
        }
        footer={
          <>
            {initialData && !loading && (
              <button
                onClick={handleExport}
                className="flex items-center space-x-1 px-3 py-2 min-h-[44px] bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                title="Download Excel"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Excel</span>
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 min-h-[44px] bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit('draft')}
              disabled={loading}
              className="px-4 py-2 min-h-[44px] bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSubmit('issue')}
              disabled={loading || formData.status === 'issued'}
              className="px-4 py-2 min-h-[44px] bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Issue'}
            </button>
          </>
        }
      >
        {/* Form Content */}
        <div className="space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
              <select
                value={formData.marketingExecutive}
                onChange={(e) => setFormData(prev => ({ ...prev, marketingExecutive: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading || loadingExecutives}
              >
                <option value="">Select Marketing Executive</option>
                {marketingExecutives.map(exec => (
                  <option key={exec._id} value={exec._id}>{exec.name}</option>
                ))}
              </select>
              {loadingExecutives && <p className="mt-1 text-sm text-gray-500">Loading executives...</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
              <CustomerAutocomplete
                value={formData.customerName}
                onNameChange={(name) => setFormData(prev => ({ ...prev, customerName: name }))}
                onSelect={(customer) => setFormData(prev => ({
                  ...prev,
                  // Fill the remembered address only when the stored one is
                  // non-empty, so picking a customer never wipes a typed address
                  ...(customer.address ? { customerAddress: customer.address } : {})
                }))}
                disabled={loading}
                hasError={!!errors.customerName}
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
            discountPercentage={documentType === 'SI' ? formData.discountPercentage : 0}
            maxRows={300}
          />
        </div>
      </Modal>
    </>
  );
};

export default DocumentForm;