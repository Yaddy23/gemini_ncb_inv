import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { ShoppingBag, Search, Plus, Barcode, Trash, Edit, Loader, CheckCircle, AlertTriangle } from 'lucide-react';

const Books = ({ user }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // Debounce search to avoid excessive API calls while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Single effect for all data fetching
  useEffect(() => {
    const isSearch = !isInitialLoad.current && (page === 1);
    isInitialLoad.current = false;
    fetchBooks(isSearch);
  }, [fetchBooks]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleDeleteBook = async (isbn) => {
    if (deleteMode) {
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
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
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
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 md:flex-1 lg:flex-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search books by title, author, ISBN..."
              value={search}
              onChange={handleSearchChange}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 md:flex-none lg:flex-auto flex justify-end space-x-3">
          {user.role === 'Admin' && (
            <button
              onClick={() => setSelectedBook({ action: 'create' })}
              className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="mr-2 w-4 h-4" />
              Add New Book
            </button>
          )}
          <button
            onClick={() => window.location.href = '/scan'}
            className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            <Barcode className="mr-2 w-4 h-4" />
            Scan Books
          </button>
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
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
                <tr>
                  <td className="px-6 py-4 text-center text-gray-500" colSpan="6">
                    No books found. Try searching or adding new books.
                  </td>
                </tr>
              ) : (
                books.map((book) => (
                  <tr key={book.ISBN} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-[120px]">{book.ISBN}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[300px]">{book.TITLE}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.AUTHOR || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.YEAR || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.PUBLISHER || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{book.QTY}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{book.PRICE.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex space-x-2">
                      <button
                        onClick={() => setSelectedBook({ action: 'edit', book })}
                        className="flex items-center justify-center px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                        disabled={deleteMode && selectedBook?.action !== 'delete'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.ISBN)}
                        className={`flex items-center justify-center px-3 py-1 ${
                          deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-800'
                        } text-xs rounded-md hover:${deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN
                            ? 'bg-red-600'
                            : 'bg-gray-300'
                        } transition-colors disabled:opacity-50`}
                        disabled={deleteMode && selectedBook?.action !== 'delete' && selectedBook?.action !== undefined}
                      >
                        {deleteMode && selectedBook?.action === 'delete' && selectedBook?.book?.ISBN === book.ISBN ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Trash className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalBooks > limit && (
        <div className="mt-6 flex items-center justify-between px-6 py-3 bg-gray-50">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, totalBooks)} of {totalBooks} books
          </p>
          <div className="flex space-x-1">
            <button
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className={`px-3 py-1 rounded-md ${page === 1 ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100'} transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-2 py-1 text-xs flex items-center justify-center w-8">{page}</span>
            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1 rounded-md ${page === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-100'} transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Book Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedBook.action === 'create' ? 'Add New Book' : 'Edit Book'}
              </h2>
              <button
                onClick={() => setSelectedBook(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
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
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  type="text"
                  name="ISBN"
                  value={formData.ISBN || ''}
                  onChange={(e) => setFormData({...formData, ISBN: e.target.value})}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <input
                    type="text"
                    name="AUTHOR"
                    value={formData.AUTHOR || ''}
                    onChange={(e) => setFormData({...formData, AUTHOR: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    name="SUBJECT"
                    value={formData.SUBJECT || ''}
                    onChange={(e) => setFormData({...formData, SUBJECT: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="text"
                    name="YEAR"
                    value={formData.YEAR || ''}
                    onChange={(e) => setFormData({...formData, YEAR: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                  <input
                    type="text"
                    name="EDITION"
                    value={formData.EDITION || ''}
                    onChange={(e) => setFormData({...formData, EDITION: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Binding</label>
                  <input
                    type="text"
                    name="BIND"
                    value={formData.BIND || ''}
                    onChange={(e) => setFormData({...formData, BIND: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    name="PUBLISHER"
                    value={formData.PUBLISHER || ''}
                    onChange={(e) => setFormData({...formData, PUBLISHER: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    name="QTY"
                    value={formData.QTY || ''}
                    onChange={(e) => setFormData({...formData, QTY: parseInt(e.target.value) || 0})}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {formError && (
                <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-md text-red-600">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : (selectedBook.action === 'create' ? 'Add Book' : 'Update Book')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;