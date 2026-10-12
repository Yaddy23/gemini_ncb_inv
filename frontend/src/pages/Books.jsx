import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ShoppingBag, Search, Plus, Barcode, Trash, Edit, Loader, CheckCircle, AlertTriangle, History } from 'lucide-react';
import { useToast } from '../components/Toast';
import { Modal, Pagination, EmptyState, AlertBanner } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';

const Books = ({ user }) => {
  const navigate = useNavigate();
  const { confirmDialog } = useToast();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalBooks, setTotalBooks] = useState(0);
  const [selectedBook, setSelectedBook] = useState(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [formData, setFormData] = useState({
    ISBN: '',
    TITLE: '',
    AUTHOR: '',
    SUBJECT: '',
    EDITION: '',
    YEAR: '',
    BIND: '',
    PUBLISHER: '',
    QTY: 0,
    PRICE: 0.00
  });
  const [formError, setFormError] = useState(null);

  // Per-book transaction history modal state
  const [historyBook, setHistoryBook] = useState(null);
  const [historyData, setHistoryData] = useState({ transactions: [], page: 1, pages: 0, total: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  // Populate formData when selectedBook changes for editing
  useEffect(() => {
    setFormError(null); // Clear form error when modal opens
    if (selectedBook?.action === 'edit' && selectedBook?.book) {
      const book = selectedBook.book;
      setFormData({
        ISBN: book.ISBN || '',
        TITLE: book.TITLE || '',
        AUTHOR: book.AUTHOR || '',
        SUBJECT: book.SUBJECT || '',
        EDITION: book.EDITION || '',
        YEAR: book.YEAR || '',
        BIND: book.BIND || '',
        PUBLISHER: book.PUBLISHER || '',
        QTY: book.QTY || 0,
        PRICE: book.PRICE || 0.00
      });
    } else if (selectedBook?.action === 'create') {
      // Reset form for create
      setFormData({
        ISBN: '',
        TITLE: '',
        AUTHOR: '',
        SUBJECT: '',
        EDITION: '',
        YEAR: '',
        BIND: '',
        PUBLISHER: '',
        QTY: 0,
        PRICE: 0.00
      });
    }
  }, [selectedBook]);

  const fetchBooks = useCallback(async (isSearch = false) => {
    try {
      if (isSearch) {
        setIsSearching(true);
      } else {
        setLoading(true);
      }
      const response = await api.get(`/books?page=${page}&limit=${limit}&search=${debouncedSearch}`);

      setBooks(response.data.books);
      setTotalPages(response.data.pages);
      setTotalBooks(response.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load books');
    } finally {
      if (isSearch) {
        setIsSearching(false);
      } else {
        setLoading(false);
      }
    }
  }, [page, limit, debouncedSearch]);

  const isInitialLoad = useRef(true);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1); // Reset to first page when searching
  };

  const debouncedSearch = useDebounce(search, 300);

  // Single effect for all data fetching
  useEffect(() => {
    const isSearch = !isInitialLoad.current && (page === 1);
    isInitialLoad.current = false;
    fetchBooks(isSearch);
  }, [fetchBooks]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const getActionBadgeClass = (action) => {
    if (action === 'INBOUND') return 'bg-green-100 text-green-700';
    if (action === 'OUTBOUND') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const openHistory = (book) => {
    setHistoryBook(book);
    setHistoryPage(1);
  };

  // Fetch the selected book's transaction history
  useEffect(() => {
    if (!historyBook) return;
    let cancelled = false;
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const response = await api.get(`/books/${encodeURIComponent(historyBook.ISBN)}/transactions`, {
          params: { page: historyPage, limit: 10 }
        });
        if (!cancelled) {
          setHistoryData({
            transactions: response.data.transactions,
            page: response.data.page,
            pages: response.data.pages,
            total: response.data.total
          });
        }
      } catch (err) {
        if (!cancelled) {
          setHistoryData({ transactions: [], page: 1, pages: 0, total: 0 });
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    fetchHistory();
    return () => { cancelled = true; };
  }, [historyBook, historyPage]);

  const handleDeleteBook = async (isbn) => {
    if (deleteMode) {
      const book = books.find(b => b.ISBN === isbn);
      const sure = await confirmDialog(
        `Delete "${book?.TITLE || isbn}"? This book and its stock record will be removed. This cannot be undone.`,
        { title: 'Delete Book', danger: true, confirmText: 'Delete' }
      );
      if (!sure) return;
      try {
        await api.delete(`/books/${isbn}`);
        setDeleteMode(false);
        // Refresh books list
        const response = await api.get(`/books?page=${page}&limit=${limit}&search=${debouncedSearch}`);
        setBooks(response.data.books);
        setTotalPages(response.data.pages);
        setTotalBooks(response.data.total);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete book');
      }
    } else {
      setDeleteMode(true);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex space-x-3">
            <Loader className="w-8 h-8 text-primary animate-spin" />
            <span className="text-primary">Loading books...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <AlertBanner tone="error">{error}</AlertBanner>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Book Catalog
        </h1>
        <p className="mt-2 text-gray-600">Manage your book inventory</p>
      </div>

      {/* Search and Controls */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search books by title, author, ISBN..."
              value={search}
              onChange={handleSearchChange}
              className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
            />
          </div>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 justify-end">
          {user.role === 'Admin' && (
            <button
              onClick={() => setSelectedBook({ action: 'create' })}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] min-w-[140px]"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add New Book</span>
            </button>
          )}
          <button
            onClick={() => navigate('/scan')}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation min-h-[44px] min-w-[140px]"
          >
            <Barcode className="w-5 h-5" />
            <span className="hidden sm:inline">Scan Books</span>
          </button>
        </div>
      </div>

      {/* Books Table - Responsive: Cards on mobile, Table on desktop */}
      <div className="bg-white rounded-lg shadow">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          {books.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No books found" message="Try searching or adding new books." />
          ) : (
            <div className="divide-y divide-gray-200">
              {books.map((book) => (
                <div key={book.ISBN} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{book.TITLE}</h3>
                      <p className="text-sm text-gray-500">by {book.AUTHOR || 'Unknown Author'}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        book.QTY > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {book.QTY > 0 ? `${book.QTY} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">ISBN:</span>
                      <span className="font-mono text-gray-900 ml-1">{book.ISBN}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Year:</span>
                      <span className="text-gray-900 ml-1">{book.YEAR || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Publisher:</span>
                      <span className="text-gray-900 ml-1">{book.PUBLISHER || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Price:</span>
                      <span className="font-medium text-gray-900 ml-1">₱{book.PRICE.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openHistory(book)}
                      disabled={deleteMode}
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation disabled:opacity-50 min-h-[44px]"
                    >
                      <History className="w-4 h-4" />
                      <span>History</span>
                    </button>
                    <button
                      onClick={() => setSelectedBook({ action: 'edit', book })}
                      disabled={deleteMode && selectedBook?.action !== 'delete'}
                      className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation disabled:opacity-50 min-h-[44px]"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBook(book.ISBN)}
                      disabled={deleteMode && selectedBook?.action !== 'delete' && selectedBook?.action !== undefined}
                      className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg touch-manipulation min-h-[44px] transition-colors disabled:opacity-50 ${
                        deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Confirm</span>
                        </>
                      ) : (
                        <>
                          <Trash className="w-4 h-4" />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px] truncate">ISBN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[300px] truncate">
                  Title {isSearching && <Loader className="w-4 h-4 text-primary animate-spin ml-2 inline" />}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px] truncate">Author</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px] truncate">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px] truncate">Publisher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px] truncate">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] truncate">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {books.length === 0 ? (
                <EmptyState colSpan={8} icon={ShoppingBag} title="No books found" message="Try searching or adding new books." />
              ) : (
                books.map((book) => (
                  <tr key={book.ISBN} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-[120px]">{book.ISBN}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[300px]">{book.TITLE}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.AUTHOR || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.YEAR || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.PUBLISHER || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {book.QTY > 0 ? book.QTY : <span className="text-red-600">Out of stock</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{book.PRICE.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openHistory(book)}
                          className="flex items-center justify-center px-3 py-1 bg-gray-200 text-gray-800 text-xs rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
                          disabled={deleteMode}
                          title="Transaction history"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedBook({ action: 'edit', book })}
                          className="flex items-center justify-center px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                          disabled={deleteMode && selectedBook?.action !== 'delete'}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.ISBN)}
                          className={
                            deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN
                              ? 'flex items-center justify-center px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors disabled:opacity-50'
                              : 'flex items-center justify-center px-3 py-1 bg-gray-200 text-gray-800 text-xs rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50'
                          }
                          disabled={deleteMode && selectedBook?.action !== 'delete' && selectedBook?.action !== undefined}
                        >
                          {deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Trash className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={totalBooks}
        limit={limit}
        onPageChange={handlePageChange}
        label="books"
      />

      {/* Add/Edit Book Modal - Full-screen on mobile, centered on desktop */}
      <Modal
        open={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        title={selectedBook?.action === 'create' ? 'Add New Book' : 'Edit Book'}
        size="md"
      >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setLoading(true);
                  let response;

                  if (selectedBook.action === 'create') {
                    response = await api.post('/books', formData);
                  } else if (selectedBook.action === 'edit') {
                    response = await api.put(`/books/${selectedBook.book.ISBN}`, formData);
                  }

                  setSelectedBook(null);
                  // Refresh books list
                  const booksResponse = await api.get(`/books?page=${page}&limit=${limit}&search=${debouncedSearch}`);
                  setBooks(booksResponse.data.books);
                  setTotalPages(booksResponse.data.pages);
                  setTotalBooks(booksResponse.data.total);
                } catch (err) {
                  setFormError(err.response?.data?.message || 'Failed to save book');
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4 md:space-y-3"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  type="text"
                  name="ISBN"
                  value={formData.ISBN || ''}
                  onChange={(e) => setFormData({...formData, ISBN: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  name="TITLE"
                  value={formData.TITLE || ''}
                  onChange={(e) => setFormData({...formData, TITLE: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <input
                    type="text"
                    name="AUTHOR"
                    value={formData.AUTHOR || ''}
                    onChange={(e) => setFormData({...formData, AUTHOR: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    name="SUBJECT"
                    value={formData.SUBJECT || ''}
                    onChange={(e) => setFormData({...formData, SUBJECT: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="text"
                    name="YEAR"
                    value={formData.YEAR || ''}
                    onChange={(e) => setFormData({...formData, YEAR: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                  <input
                    type="text"
                    name="EDITION"
                    value={formData.EDITION || ''}
                    onChange={(e) => setFormData({...formData, EDITION: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Binding</label>
                  <input
                    type="text"
                    name="BIND"
                    value={formData.BIND || ''}
                    onChange={(e) => setFormData({...formData, BIND: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    name="PUBLISHER"
                    value={formData.PUBLISHER || ''}
                    onChange={(e) => setFormData({...formData, PUBLISHER: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    name="QTY"
                    value={formData.QTY || ''}
                    onChange={(e) => setFormData({...formData, QTY: parseInt(e.target.value) || 0})}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="number"
                    name="PRICE"
                    value={formData.PRICE || ''}
                    onChange={(e) => setFormData({...formData, PRICE: parseFloat(e.target.value) || 0.0})}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
                  />
                </div>
              </div>

              {formError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                  {formError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4 md:mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation min-h-[44px] min-w-[120px]"
                >
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg disabled:opacity-50 transition-colors touch-manipulation min-h-[44px] min-w-[120px]"
                >
                  {loading ? (
                    <>
                      <span>Saving...</span>
                      <svg className="animate-spin w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>{selectedBook.action === 'create' ? 'Add Book' : 'Update Book'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        open={!!historyBook}
        onClose={() => setHistoryBook(null)}
        title={
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Stock History</h2>
            <p className="text-sm text-gray-500 truncate font-normal">{historyBook?.TITLE} · {historyBook?.ISBN}</p>
          </div>
        }
        size="md"
      >
        {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 text-primary animate-spin" />
                <span className="ml-2 text-primary">Loading history...</span>
              </div>
            ) : historyData.transactions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <History className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No transactions yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyData.transactions.map((t) => (
                  <div key={t._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getActionBadgeClass(t.action)}`}>{t.action}</span>
                      <span className={`text-sm font-bold ${t.qtyChanged > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.qtyChanged > 0 ? '+' : ''}{t.qtyChanged}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {t.previousQty} → {t.newQty} · {t.performedBy?.username || 'Unknown'} · {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {historyData.total > 10 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-sm text-gray-500">Page {historyData.page} of {historyData.pages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                    disabled={historyPage === 1 || historyLoading}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors touch-manipulation min-h-[44px]"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setHistoryPage(Math.min(historyData.pages, historyPage + 1))}
                    disabled={historyPage === historyData.pages || historyLoading}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors touch-manipulation min-h-[44px]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
      </Modal>
    </div>
  );
};

export default Books;