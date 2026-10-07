import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { drsiApi } from '../../api/drsi';
import { formatCurrency } from '../../utils/numberToWords';

const LineItemsTable = ({ items, onItemsChange, documentType, maxRows = 39 }) => {
  const [lookupLoading, setLookupLoading] = useState({});
  const [lookupErrors, setLookupErrors] = useState({});
  const isbnInputRefs = useRef({});

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

  const handleISBNChange = async (index, isbn) => {
    const cleanISBN = isbn.trim();
    const newItems = [...items];
    newItems[index] = { ...newItems[index], isbn: cleanISBN };

    if (cleanISBN.length >= 8) {
      setLookupLoading(prev => ({ ...prev, [index]: true }));
      setLookupErrors(prev => ({ ...prev, [index]: null }));

      try {
        const response = await drsiApi.lookupBook(cleanISBN);
        const book = response.data;

        if (book && book.ISBN) {
          const description = formatDescription(book);
          newItems[index] = {
            ...newItems[index],
            title: description, // Store formatted description
            // Keep raw fields for export
            rawTitle: book.TITLE,
            edition: book.EDITION,
            bind: book.BIND,
            year: book.YEAR,
            author: book.AUTHOR,
            unitPrice: book.PRICE || 0,
            amount: (book.PRICE || 0) * (newItems[index].qty || 1)
          };
          setLookupErrors(prev => ({ ...prev, [index]: null }));
        } else {
          setLookupErrors(prev => ({ ...prev, [index]: 'Book not found' }));
        }
      } catch (err) {
        setLookupErrors(prev => ({ ...prev, [index]: 'Lookup failed' }));
      } finally {
        setLookupLoading(prev => ({ ...prev, [index]: false }));
      }
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
    }

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

  return (
    <div className="space-y-4">
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
              <tr key={index} className="hover:bg-gray-50">
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
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                      autoComplete="off"
                    />
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
                    {item.title && !lookupLoading[index] && !lookupErrors[index] && (
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
                    readOnly
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-50 text-gray-700"
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
            <tr>
              <td colSpan="6" className="px-3 py-2 text-right font-bold text-primary">TOTAL:</td>
              <td className="px-3 py-2 font-bold text-primary text-right">{formatCurrency(subtotal)}</td>
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