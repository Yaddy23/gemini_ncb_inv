import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Barcode, ShoppingBag, Loader, CheckCircle, AlertTriangle, Plus, Minus, Trash2, RotateCcw } from 'lucide-react';

const Scan = ({ user }) => {
  const [mode, setMode] = useState(null); // 'inbound' | 'outbound' | null
  const [isbn, setIsbn] = useState('');
  const [bookInfo, setBookInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const isbnInputRef = useRef(null);

  // Auto-focus the ISBN input on mount and when mode changes
  useEffect(() => {
    if (isbnInputRef.current) {
      isbnInputRef.current.focus();
    }
  }, [mode]);

  // Auto-lookup and process when ISBN changes (for scanner input)
  useEffect(() => {
    if (!mode || !isbn || isbn.length < 8) return; // Need mode and valid ISBN

    const timer = setTimeout(() => {
      processScan(isbn);
    }, 300); // Small delay to allow scanner to finish typing

    return () => clearTimeout(timer);
  }, [isbn, mode]);

  const processScan = async (code) => {
    setLoading(true);
    setError(null);

    try {
      const config = {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      };

      // First lookup the book
      const lookupResponse = await axios.get(`/api/books/lookup/${code}`, config);

      if (!lookupResponse.data || !lookupResponse.data.ISBN) {
        throw new Error('Book not found in inventory');
      }

      const book = lookupResponse.data;

      // Then process stock action (always qty = 1)
      const stockResponse = await axios.patch(`/api/stock/${book.ISBN}/stock`, {
        action: mode === 'inbound' ? 'INBOUND' : 'OUTBOUND',
        qtyChanged: 1
      }, config);

      const updatedBook = stockResponse.data;

      // Add to recent scans
      setRecentScans(prev => [
        {
          isbn: book.ISBN,
          title: book.TITLE,
          action: mode === 'inbound' ? 'IN' : 'OUT',
          qty: 1,
          newStock: updatedBook.QTY,
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 19) // Keep last 20
      ]);

      // Update book info display
      setBookInfo(updatedBook);

      // Success message
      setSuccess(`${mode === 'inbound' ? 'Added' : 'Removed'} 1 unit to "${book.TITLE}" (Stock: ${updatedBook.QTY})`);

      // Clear ISBN for next scan
      setIsbn('');

      // Re-focus input for next scan
      setTimeout(() => {
        if (isbnInputRef.current) {
          isbnInputRef.current.focus();
        }
      }, 50);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(`Failed to ${mode === 'inbound' ? 'receive' : 'ship'} stock: ${msg}`);

      // Still clear ISBN so user can scan next
      setIsbn('');
      setTimeout(() => {
        if (isbnInputRef.current) {
          isbnInputRef.current.focus();
        }
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const setModeAndFocus = (newMode) => {
    setMode(newMode);
    setIsbn('');
    setBookInfo(null);
    setError(null);
    setSuccess(null);
    setTimeout(() => {
      if (isbnInputRef.current) {
        isbnInputRef.current.focus();
      }
    }, 100);
  };

  const clearMode = () => {
    setMode(null);
    setIsbn('');
    setBookInfo(null);
    setError(null);
    setSuccess(null);
    setRecentScans([]);
    setTimeout(() => {
      if (isbnInputRef.current) {
        isbnInputRef.current.focus();
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-3xl space-y-6 mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
              <Barcode className="w-6 h-6 text-primary" />
              <span>Barcode Stock Scanner</span>
            </h1>
          </div>

          {/* Mode Selection - Only shown when no mode selected */}
          {!mode && (
            <div className="space-y-4">
              <p className="text-center text-gray-600 text-lg">Select operation mode to begin scanning</p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setModeAndFocus('inbound')}
                  className="flex flex-col items-center justify-center p-6 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 hover:border-green-400 transition-all"
                >
                  <ShoppingBag className="w-12 h-12 text-green-600 mb-3" />
                  <span className="text-xl font-bold text-green-800">Receive Stock (IN)</span>
                  <span className="text-sm text-green-600 mt-1">Scan books to add +1 qty</span>
                </button>

                <button
                  onClick={() => setModeAndFocus('outbound')}
                  className="flex flex-col items-center justify-center p-6 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 hover:border-red-400 transition-all"
                >
                  <Trash2 className="w-12 h-12 text-red-600 mb-3" />
                  <span className="text-xl font-bold text-red-800">Ship Stock (OUT)</span>
                  <span className="text-sm text-red-600 mt-1">Scan books to remove -1 qty</span>
                </button>
              </div>

              <p className="text-center text-xs text-gray-500">
                Hardware barcode scanners work automatically - just scan ISBN barcodes
              </p>
            </div>
          )}

          {/* Active Scanning Mode */}
          {mode && (
            <div className="space-y-4">
              {/* Mode Header */}
              <div className={`flex items-center justify-between p-4 rounded-xl ${
                mode === 'inbound' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    mode === 'inbound' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {mode === 'inbound' ? (
                      <ShoppingBag className="w-5 h-5 text-green-600" />
                    ) : (
                      <Trash2 className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h2 className={`font-bold text-lg ${mode === 'inbound' ? 'text-green-800' : 'text-red-800'}`}>
                      {mode === 'inbound' ? 'Receive Stock Mode' : 'Ship Stock Mode'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Scans will automatically {mode === 'inbound' ? 'add +1' : 'remove -1'} qty
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearMode}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Change Mode</span>
                </button>
              </div>

              {/* ISBN Input - Auto-focused */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scan ISBN Barcode
                </label>
                <div className="relative">
                  <input
                    ref={isbnInputRef}
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder={loading ? "Processing..." : "Scan barcode or type ISBN..."}
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                    autoComplete="off"
                    spellCheck="false"
                    disabled={loading}
                  />
                  <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  {loading && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Loader className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  {mode === 'inbound' ? '📦 Scanning adds +1 to stock' : '📤 Scanning removes -1 from stock'} • Auto-focuses after each scan
                </p>
              </div>

              {/* Current Book Display */}
              {bookInfo && (
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{bookInfo.TITLE}</h3>
                      <p className="text-sm text-gray-600">by {bookInfo.AUTHOR || 'Unknown Author'}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        <span className="font-medium text-gray-700">ISBN: {bookInfo.ISBN}</span>
                        <span className={`font-bold text-lg ${mode === 'inbound' ? 'text-green-600' : 'text-red-600'}`}>
                          Stock: {bookInfo.QTY}
                        </span>
                        {bookInfo.SUBJECT && <span className="text-gray-500">{bookInfo.SUBJECT}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 flex-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-700 flex-1">{success}</p>
                    <button
                      onClick={() => setSuccess(null)}
                      className="text-sm text-green-600 hover:text-green-800 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Scans History */}
              {recentScans.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <Barcode className="w-5 h-5 text-gray-500" />
                      Recent Scans ({recentScans.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {recentScans.map((scan, index) => (
                      <div key={index} className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{scan.title}</p>
                          <p className="text-xs text-gray-500">ISBN: {scan.isbn} • {scan.timestamp}</p>
                        </div>
                        <div className="flex items-center space-x-3 ml-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            scan.action === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {scan.action === 'IN' ? '+1' : '-1'}
                          </span>
                          <span className="text-sm font-medium text-gray-700 w-16 text-right">
                            {scan.newStock}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-600">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
            <Barcode className="w-4 h-4 text-primary" />
            How to Use
          </h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Select <strong>Receive Stock</strong> to add inventory or <strong>Ship Stock</strong> to remove</li>
            <li>Point your barcode scanner at a book's ISBN barcode</li>
            <li>Each scan automatically updates stock by <strong>±1</strong></li>
            <li>Input auto-focuses after each scan - just keep scanning</li>
            <li>Recent scans are shown below with new stock levels</li>
            <li>Click "Change Mode" to switch between Receive/Ship</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Scan;