import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, Loader, CheckCircle, AlertTriangle, Copy, AlertCircle, Ban } from 'lucide-react';
import { drsiApi } from '../../api/drsi';
import { formatCurrency } from '../../utils/numberToWords';
import { useToast } from '../Toast';

const LineItemsTable = ({ items, onItemsChange, documentType, discountPercentage = 0, maxRows = 39 }) => {
  const { toast } = useToast();
  const [lookupLoading, setLookupLoading] = useState({});
  const [lookupErrors, setLookupErrors] = useState({});
  const [focusNextInput, setFocusNextInput] = useState(false);
  const isbnInputRefs = useRef({});
  const lookupTimersRef = useRef({}); // per-row debounce timers
  const lookupSeqRef = useRef({}); // per-row sequence numbers to discard stale responses
  const itemsRef = useRef(items); // latest items, so a lookup firing after other rows changed doesn't clobber them
  itemsRef.current = items;

  // Clear all pending debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(lookupTimersRef.current).forEach(timer => clearTimeout(timer));
      lookupTimersRef.current = {};
    };
  }, []);

  // Focus the next input when a new row is added after successful scan
  useEffect(() => {
    if (focusNextInput && isbnInputRefs.current[items.length - 1]) {
      isbnInputRefs.current[items.length - 1].focus();
      setFocusNextInput(false);
    }
  }, [focusNextInput, items.length]);

  // Find duplicate ISBNs in real-time
  const duplicateISBNs = useMemo(() => {
    const isbnMap = {};
    items.forEach((item, index) => {
      const isbn = item.isbn?.trim();
      if (isbn) {
        if (!isbnMap[isbn]) isbnMap[isbn] = [];
        isbnMap[isbn].push(index);
      }
    });
    const duplicates = {};
    Object.entries(isbnMap).forEach(([isbn, indices]) => {
      if (indices.length > 1) {
        indices.forEach(idx => {
          duplicates[idx] = { isbn, count: indices.length, indices };
        });
      }
    });
    return duplicates;
  }, [items]);

  // Helper to format description: "Title / Edition / Bind / Year / by Author"
  const formatDescription = (book) => {
    const parts = [];
    if (book.TITLE) parts.push(book.TITLE);
    if (book.EDITION) parts.push(book.EDITION);
    if (book.BIND) parts.push(book.BIND);
    if (book.YEAR) parts.push(book.YEAR);
    if (book.AUTHOR) parts.push(`by ${book.AUTHOR}`);
    return parts.join(' / ');
  };

  // Performs the (debounced) book lookup for a row, guarded by a per-row
  // sequence number so stale/out-of-order responses are discarded.
  const performLookup = async (index, isbn) => {
    const seq = (lookupSeqRef.current[index] || 0) + 1;
    lookupSeqRef.current[index] = seq;

    setLookupLoading(prev => ({ ...prev, [index]: true }));
    setLookupErrors(prev => ({ ...prev, [index]: null }));

    try {
      const response = await drsiApi.lookupBook(isbn);
      const book = response.data;

      // Discard stale responses: a newer keystroke already started/bumped this row
      if (lookupSeqRef.current[index] !== seq) return;

      if (book && book.ISBN) {
        // Block outbound documents for out-of-stock or fully reserved books
        // (same rules as the Scan page). Books from the Open Library fallback
        // have no QTY, so there is nothing to block on for those.
        const reservedQty = book.reservedQty || 0;
        const availableStock = (book.QTY || 0) - reservedQty;
        let stockBlocked = false;
        if (book.QTY !== undefined) {
          if (book.QTY === 0) {
            toast.error(`⛔ "${book.TITLE}" is OUT OF STOCK (0 available) - cannot be added`);
            stockBlocked = true;
          } else if (availableStock <= 0) {
            toast.error(`⛔ "${book.TITLE}" is FULLY RESERVED (${reservedQty} reserved, 0 available) - cannot be added`);
            stockBlocked = true;
          } else if (reservedQty > 0) {
            // Warn but allow (some stock available)
            toast.info(`⚠️ "${book.TITLE}" has ${reservedQty} reserved (${availableStock} available)`);
          }
        }

        // Read the latest items from the ref so edits made to other rows
        // during the debounce window are not overwritten
        const updatedItems = [...itemsRef.current];

        if (stockBlocked) {
          // Keep the row empty (no title/price) and flag it so the item
          // cannot be added or submitted
          updatedItems[index] = {
            ...updatedItems[index],
            stockBlocked: true,
            title: '',
            rawTitle: '',
            edition: '',
            bind: '',
            year: '',
            author: '',
            unitPrice: 0,
            amount: 0
          };
          onItemsChange(updatedItems);
          return;
        }

        const description = formatDescription(book);
        updatedItems[index] = {
          ...updatedItems[index],
          stockBlocked: false,
          title: description, // Store formatted description
          // Keep raw fields for export
          rawTitle: book.TITLE,
          edition: book.EDITION,
          bind: book.BIND,
          year: book.YEAR,
          author: book.AUTHOR,
          unitPrice: book.PRICE || 0,
          amount: (book.PRICE || 0) * (updatedItems[index].qty || 1)
        };
        setLookupErrors(prev => ({ ...prev, [index]: null }));

        // Auto-add new row after successful scan if this is the last row and we haven't reached maxRows
        if (index === updatedItems.length - 1 && updatedItems.length < maxRows) {
          updatedItems.push({
            isbn: '',
            title: '',
            rawTitle: '',
            edition: '',
            bind: '',
            year: '',
            author: '',
            qty: 1,
            unitPrice: 0,
            amount: 0
          });
          // Trigger focus on the new input after state updates
          setFocusNextInput(true);
        }
        onItemsChange(updatedItems);
      } else {
        setLookupErrors(prev => ({ ...prev, [index]: 'Book not found - enter title manually' }));
      }
    } catch (err) {
      if (lookupSeqRef.current[index] !== seq) return;
      setLookupErrors(prev => ({ ...prev, [index]: 'Lookup failed - enter title manually' }));
    } finally {
      if (lookupSeqRef.current[index] === seq) {
        setLookupLoading(prev => ({ ...prev, [index]: false }));
      }
    }
  };

  const handleISBNChange = (index, isbn) => {
    const cleanISBN = isbn.trim();
    const newItems = [...items];
    newItems[index] = { ...newItems[index], isbn: cleanISBN, stockBlocked: false };

    // Cancel any pending debounced lookup for this row and invalidate
    // any lookup already in flight (stale responses will be discarded)
    if (lookupTimersRef.current[index] !== undefined) {
      clearTimeout(lookupTimersRef.current[index]);
      delete lookupTimersRef.current[index];
    }
    lookupSeqRef.current[index] = (lookupSeqRef.current[index] || 0) + 1;

    if (cleanISBN.length >= 8) {
      // Debounce: only look up after the user pauses typing (~400ms)
      lookupTimersRef.current[index] = setTimeout(() => {
        delete lookupTimersRef.current[index];
        performLookup(index, cleanISBN);
      }, 400);
    } else {
      // Clear title/price if ISBN too short
      newItems[index] = {
        ...newItems[index],
        title: '',
        rawTitle: '',
        edition: '',
        bind: '',
        year: '',
        author: '',
        unitPrice: 0,
        amount: 0
      };
      // Clear lookup state left over from a previous longer ISBN
      setLookupLoading(prev => ({ ...prev, [index]: false }));
      setLookupErrors(prev => ({ ...prev, [index]: null }));
    }

    // ISBN value propagates immediately on every keystroke
    onItemsChange(newItems);
  };

  const handleTitleChange = (index, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], title: value, rawTitle: value };
    // Clearing the lookup error lets submit proceed and hides the error badge
    setLookupErrors(prev => ({ ...prev, [index]: null }));
    onItemsChange(newItems);
  };

  const handleQtyChange = (index, qty) => {
    const newItems = [...items];
    const q = Math.max(1, Number(qty) || 1);
    newItems[index] = {
      ...newItems[index],
      qty: q,
      amount: q * (newItems[index].unitPrice || 0)
    };
    onItemsChange(newItems);
  };

  const handlePriceChange = (index, price) => {
    const newItems = [...items];
    const p = Math.max(0, Number(price) || 0);
    newItems[index] = {
      ...newItems[index],
      unitPrice: p,
      amount: p * (newItems[index].qty || 1)
    };
    onItemsChange(newItems);
  };

  const addRow = () => {
    if (items.length >= maxRows) return;
    const newItems = [...items, {
      isbn: '',
      title: '',
      rawTitle: '',
      edition: '',
      bind: '',
      year: '',
      author: '',
      qty: 1,
      unitPrice: 0,
      amount: 0
    }];
    onItemsChange(newItems);
  };

  const removeRow = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const discountAmount = (subtotal * (discountPercentage || 0)) / 100;
  const grandTotal = subtotal - discountAmount;

// Get unique duplicate ISBNs for summary
  const uniqueDuplicateISBNs = useMemo(() => {
    const seen = new Set();
    const unique = [];
    Object.values(duplicateISBNs).forEach(dup => {
      if (!seen.has(dup.isbn)) {
        seen.add(dup.isbn);
        unique.push(dup);
      }
    });
    return unique;
  }, [duplicateISBNs]);

  return (
    <div className="space-y-4">
      {/* Duplicate ISBN Warning Banner */}
      {uniqueDuplicateISBNs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-yellow-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Duplicate ISBNs detected:</span>
          </div>
          <div className="mt-2 text-sm text-yellow-700">
            {uniqueDuplicateISBNs.map((dup, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="font-mono bg-yellow-100 px-2 py-0.5 rounded">{dup.isbn}</span>
                <span>appears {dup.count} time{dup.count > 1 ? 's' : ''}</span>
                <span className="text-yellow-600">(lines: {dup.indices.map(i => i + 1).join(', ')})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="font-medium text-gray-700">Line Items ({items.length}/{maxRows})</label>
        <button
          onClick={addRow}
          disabled={items.length >= maxRows}
          className="flex items-center space-x-1 px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">CODE</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">QTY</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-48">ISBN / BARCODE</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">TITLE / DESCRIPTION</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">UNIT PRICE</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">AMOUNT</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={index} className={`hover:bg-gray-50 ${item.stockBlocked ? 'bg-red-50' : duplicateISBNs[index] ? 'bg-yellow-50' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                  {item.isbn?.substring(0, 8) || ''}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.qty || 1}
                    onChange={(e) => handleQtyChange(index, e.target.value)}
                    min="1"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <input
                      ref={(el) => { isbnInputRefs.current[index] = el; }}
                      type="text"
                      value={item.isbn || ''}
                      onChange={(e) => handleISBNChange(index, e.target.value)}
                      placeholder="Scan or type ISBN"
                      className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary pr-12 ${
                        item.stockBlocked
                          ? 'border-red-400 bg-red-50'
                          : duplicateISBNs[index]
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-gray-300'
                      }`}
                      autoComplete="off"
                    />
                    {item.stockBlocked && !lookupLoading[index] && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Ban className="w-4 h-4 text-red-500" title="Out of stock or fully reserved - cannot be added" />
                      </div>
                    )}
                    {lookupLoading[index] && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                    {lookupErrors[index] && !lookupLoading[index] && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <AlertTriangle className="w-4 h-4 text-red-500" title={lookupErrors[index]} />
                      </div>
                    )}
                    {duplicateISBNs[index] && !lookupLoading[index] && !lookupErrors[index] && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" title={`Duplicate ISBN (${duplicateISBNs[index].count} occurrences)`} />
                      </div>
                    )}
                    {item.title && !item.stockBlocked && !lookupLoading[index] && !lookupErrors[index] && !duplicateISBNs[index] && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.title || ''}
                    readOnly={!!lookupErrors[index] && !lookupLoading[index] ? false : true}
                    onChange={(e) => handleTitleChange(index, e.target.value)}
                    placeholder={lookupErrors[index] ? 'Enter title manually' : ''}
                    className={`w-full px-2 py-1 text-sm border rounded ${
                      lookupErrors[index] && !lookupLoading[index]
                        ? 'border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.unitPrice || 0}
                    onChange={(e) => handlePriceChange(index, e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                  {formatCurrency(item.amount || 0)}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removeRow(index)}
                    disabled={items.length <= 1}
                    className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="8" className="px-3 py-8 text-center text-gray-400">
                  No items added yet. Click "Add Item" to start.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan="6" className="px-3 py-2 text-right font-bold text-gray-700">SUBTOTAL:</td>
              <td className="px-3 py-2 font-bold text-gray-900 text-right">{formatCurrency(subtotal)}</td>
              <td></td>
            </tr>
            {documentType === 'SI' && discountPercentage > 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-2 text-right font-bold text-gray-700">LESS {discountPercentage}% DISCOUNT:</td>
                <td className="px-3 py-2 font-bold text-gray-900 text-right">{formatCurrency(discountAmount)}</td>
                <td></td>
              </tr>
            )}
            <tr>
              <td colSpan="6" className="px-3 py-2 text-right font-bold text-primary">TOTAL:</td>
              <td className="px-3 py-2 font-bold text-primary text-right">{formatCurrency(documentType === 'SI' ? grandTotal : subtotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {items.length < maxRows && (
        <p className="text-xs text-gray-500 text-center">
          {maxRows - items.length} more rows available
        </p>
      )}
    </div>
  );
};

export default LineItemsTable;