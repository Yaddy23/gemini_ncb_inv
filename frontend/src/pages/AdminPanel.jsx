import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, X, Edit as EditIcon, Trash2, CheckCircle, RotateCcw, ShoppingBag } from 'lucide-react';
import { useToast } from '../components/Toast';
import { Pagination, AlertBanner, EmptyState } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';

const AdminPanel = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [userLogs, setUserLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [logActions, setLogActions] = useState([]);
  const [logUsers, setLogUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [logsPerPage, setLogsPerPage] = useState(50);
  const [activeTab, setActiveTab] = useState('users');

  const { confirmDialog, toast } = useToast();

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Staff'
  });

  // Marketing Executive states
  const [executives, setExecutives] = useState([]);
  const [execCurrentPage, setExecCurrentPage] = useState(1);
  const [execTotalPages, setExecTotalPages] = useState(1);
  const [execTotal, setExecTotal] = useState(0);
  const [execSearch, setExecSearch] = useState('');
  const [execIsActiveFilter, setExecIsActiveFilter] = useState('');
  const [showExecCreateModal, setShowExecCreateModal] = useState(false);
  const [showExecEditModal, setShowExecEditModal] = useState(false);
  const [editingExecutive, setEditingExecutive] = useState(null);
  const [newExecutive, setNewExecutive] = useState({
    name: '',
    isActive: true
  });

  // Archived Books states
  const [archivedBooks, setArchivedBooks] = useState([]);
  const [bookCurrentPage, setBookCurrentPage] = useState(1);
  const [bookTotalPages, setBookTotalPages] = useState(1);
  const [bookTotal, setBookTotal] = useState(0);
  const [bookSearch, setBookSearch] = useState('');

  // Sessions states
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
    search: ''
  });

  // Fetch users
  const fetchUsers = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/auth/users?page=${page}&limit=${usersPerPage}&search=${search}`);
      setUsers(response.data.users);
      setTotalPages(response.data.pages);
      setTotalUsers(response.data.total);
      setCurrentPage(page);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user logs
  const fetchUserLogs = async (page = 1) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: logsPerPage.toString(),
        action: filters.action,
        userId: filters.userId,
        startDate: filters.startDate,
        endDate: filters.endDate
      }).toString();

      const response = await api.get(`/user-logs?${queryParams}`);
      setUserLogs(response.data.logs);
      setFilteredLogs(response.data.logs); // For export functionality
      setTotalPages(response.data.pages);
      setTotalLogs(response.data.total);
      setCurrentPage(page);
    } catch (err) {
      setError('Failed to fetch user logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      const [actionsRes, usersRes] = await Promise.all([
        api.get(`/user-logs/actions`),
        api.get(`/user-logs/users`)
      ]);
      setLogActions(actionsRes.data.actions);
      setLogUsers(usersRes.data.users);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId) => {
    if (await confirmDialog('Are you sure you want to delete this user?', { title: 'Delete User', danger: true, confirmText: 'Delete' })) {
      setLoading(true);
      try {
        await api.delete(`/auth/users/${userId}`);
        setSuccess('User deleted successfully');
        fetchUsers(currentPage, filters.search);
      } catch (err) {
        setError('Failed to delete user');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle user status toggle
  const handleToggleStatus = async (userId, isActive) => {
    setLoading(true);
    try {
      await api.put(`/auth/users/${userId}`, {
        isActive: !isActive
      });
      setSuccess('User status updated successfully');
      fetchUsers(currentPage, filters.search);
    } catch (err) {
      setError('Failed to update user status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle user role change
  const handleRoleChange = async (userId, role) => {
    const newRole = role === 'Admin' ? 'Staff' : 'Admin';
    setLoading(true);
    try {
      await api.put(`/auth/users/${userId}`, {
        role: newRole
      });
      setSuccess('User role updated successfully');
      fetchUsers(currentPage, filters.search);
    } catch (err) {
      setError('Failed to update user role');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle create new user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', newUser);
      setSuccess('User created successfully');
      setShowCreateModal(false);
      setNewUser({ username: '', email: '', password: '', role: 'Staff' });
      fetchUsers(currentPage, filters.search);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle filters change
  const handleFiltersChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    // Reset to first page when filters change
    fetchUserLogs(1);
  };

  // Handle date change
  const handleDateChange = (field, date) => {
    setFilters(prev => ({
      ...prev,
      [field]: date ? date.toISOString().split('T')[0] : ''
    }));
    fetchUserLogs(1);
  };

  // Export logs
  const exportLogs = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        action: filters.action,
        userId: filters.userId,
        startDate: filters.startDate,
        endDate: filters.endDate
      }).toString();

      const response = await api.get(`/user-logs/export?${queryParams}`, { responseType: 'blob' });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user-logs-${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess('Logs exported successfully');
    } catch (err) {
      setError('Failed to export logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch marketing executives
  const fetchExecutives = async (page = 1, search = '', isActive = '') => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search
      });
      if (isActive !== '') {
        queryParams.append('isActive', isActive);
      }

      const response = await api.get(`/marketing-executives?${queryParams.toString()}`);
      setExecutives(response.data.executives);
      setExecTotalPages(response.data.pages);
      setExecTotal(response.data.total);
      setExecCurrentPage(page);
    } catch (err) {
      setError('Failed to fetch marketing executives');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch archived books
  const fetchArchivedBooks = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        archived: 'true'
      });

      const response = await api.get(`/books?${queryParams.toString()}`);
      setArchivedBooks(response.data.books);
      setBookTotalPages(response.data.pages);
      setBookTotal(response.data.total);
      setBookCurrentPage(page);
    } catch (err) {
      setError('Failed to fetch archived books');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user sessions
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await api.get('/auth/sessions');
      setSessions(response.data.sessions || []);
    } catch (err) {
      setError('Failed to fetch sessions');
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Revoke a specific session
  const handleRevokeSession = async (sessionId) => {
    const sure = await confirmDialog(
      'Are you sure you want to revoke this session? This will log out the user from that device.',
      { title: 'Revoke Session', danger: true, confirmText: 'Revoke' }
    );
    if (!sure) return;
    setSessionsLoading(true);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      toast.success('Session revoked successfully');
      fetchSessions();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to revoke session';
      setError(message);
      toast.error(message);
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Revoke all sessions
  const handleRevokeAllSessions = async () => {
    const sure = await confirmDialog(
      'Are you sure you want to revoke all sessions? This will log you out from all devices.',
      { title: 'Revoke All Sessions', danger: true, confirmText: 'Revoke All' }
    );
    if (!sure) return;
    setSessionsLoading(true);
    try {
      await api.delete('/auth/sessions');
      toast.success('All sessions revoked successfully');
      fetchSessions();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to revoke all sessions';
      setError(message);
      toast.error(message);
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Handle marketing executive creation
  const handleCreateExecutive = async (e) => {
    e.preventDefault();
    if (!newExecutive.name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/marketing-executives', newExecutive);
      setSuccess('Marketing Executive created successfully');
      setShowExecCreateModal(false);
      setNewExecutive({ name: '', isActive: true });
      fetchExecutives(execCurrentPage, execSearch, execIsActiveFilter);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create marketing executive');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle marketing executive update
  const handleUpdateExecutive = async (e) => {
    e.preventDefault();
    if (!editingExecutive) return;
    if (!newExecutive.name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.put(`/marketing-executives/${editingExecutive._id}`, newExecutive);
      setSuccess('Marketing Executive updated successfully');
      setShowExecEditModal(false);
      setEditingExecutive(null);
      setNewExecutive({ name: '', isActive: true });
      fetchExecutives(execCurrentPage, execSearch, execIsActiveFilter);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update marketing executive');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle marketing executive deletion
  const handleDeleteExecutive = async (id) => {
    const sure = await confirmDialog('Are you sure you want to delete this marketing executive?', { title: 'Delete Marketing Executive', danger: true, confirmText: 'Delete' });
    if (!sure) return;
    setLoading(true);
    try {
      await api.delete(`/marketing-executives/${id}`);
      setSuccess('Marketing Executive deleted successfully');
      fetchExecutives(execCurrentPage, execSearch, execIsActiveFilter);
    } catch (err) {
      setError('Failed to delete marketing executive');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle restore archived book
  const handleRestoreBook = async (isbn) => {
    const book = archivedBooks.find(b => b.ISBN === isbn);
    const sure = await confirmDialog(
      `Restore "${book?.TITLE || isbn}"? This will make the book visible in the catalog again.`,
      { title: 'Restore Book', confirmText: 'Restore' }
    );
    if (!sure) return;
    setLoading(true);
    try {
      await api.put(`/books/${isbn}/restore`);
      setSuccess('Book restored successfully');
      fetchArchivedBooks(bookCurrentPage, bookSearch);
    } catch (err) {
      setError('Failed to restore book');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit executive modal open
  const handleEditExecutive = (executive) => {
    setEditingExecutive(executive);
    setNewExecutive({ name: executive.name, isActive: executive.isActive });
    setShowExecEditModal(true);
  };

  // Initialize data
  useEffect(() => {
    fetchUsers();
    fetchUserLogs();
    fetchFilterOptions();
    fetchExecutives();
  }, []);

  // Debounce search inputs so typing doesn't fire a request per keystroke
  const debouncedFiltersSearch = useDebounce(filters.search, 400);
  const debouncedExecSearch = useDebounce(execSearch, 400);
  const debouncedBookSearch = useDebounce(bookSearch, 400);

  // Refetch when page or debounced search changes
  useEffect(() => {
    if (users.length > 0) {
      fetchUsers(currentPage, debouncedFiltersSearch);
    }
    if (userLogs.length > 0) {
      fetchUserLogs(currentPage);
    }
  }, [currentPage, debouncedFiltersSearch]);

  // Refetch executives when page, search, or filter changes
  useEffect(() => {
    if (executives.length > 0 || debouncedExecSearch !== undefined || execIsActiveFilter !== undefined) {
      fetchExecutives(execCurrentPage, debouncedExecSearch, execIsActiveFilter);
    }
  }, [execCurrentPage, debouncedExecSearch, execIsActiveFilter]);

  // Refetch archived books when page or search changes
  useEffect(() => {
    if (archivedBooks.length > 0 || debouncedBookSearch !== undefined) {
      fetchArchivedBooks(bookCurrentPage, debouncedBookSearch);
    }
  }, [bookCurrentPage, debouncedBookSearch]);

  if (!user || user.role !== 'Admin') {
    return <div className="p-4 sm:p-6">Access denied. Admin privileges required.</div>;
  }

  return (
    <>
      <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-600 mt-1">Manage users and view activity logs</p>
      </div>

      {/* Status Messages */}
      {error && <AlertBanner tone="error">{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      {/* Tabs - scrollable on mobile */}
      <div className="mb-4 sm:mb-6 overflow-x-auto pb-2">
        <div className="flex space-x-2 min-w-max">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              activeTab === 'users' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            User Management
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              activeTab === 'logs' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            Activity Logs
          </button>
          <button
            onClick={() => setActiveTab('executives')}
            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              activeTab === 'executives' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            Marketing Executives
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              activeTab === 'books' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <ShoppingBag className="w-4 h-4 inline mr-1" />
            Books
          </button>
          <button
            onClick={() => { setActiveTab('sessions'); fetchSessions(); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
              activeTab === 'sessions' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <RotateCcw className="w-4 h-4 inline mr-1" />
            Sessions
          </button>
        </div>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1">
              <input
                type="text"
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, search: e.target.value }));
                  setCurrentPage(1);
                  fetchUsers(1, e.target.value);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] min-w-[140px]"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add New User</span>
            </button>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {loading ? (
              <div className="p-6 text-center">
                <div className="flex space-x-3 justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary self-center">Loading users...</span>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p>No users found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                {users.map((user) => (
                  <div key={user._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{user.username}</h3>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                      <span className={`flex-shrink-0 px-2 py-1 text-xs font-bold rounded-full ${
                        user.role === 'Admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleToggleStatus(user._id, user.isActive)}
                        disabled={loading}
                        className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg touch-manipulation min-h-[44px] transition-colors disabled:opacity-50 ${
                          user.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        <span className="text-sm font-medium">{user.isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        onClick={() => handleRoleChange(user._id, user.role)}
                        disabled={loading}
                        className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                      >
                        <span className="text-sm font-medium">Change Role</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        disabled={loading}
                        className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                      >
                        <span className="text-sm font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'Admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleToggleStatus(user._id, user.isActive)}
                          disabled={loading}
                          className={`px-3 py-1 text-xs font-medium ${user.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleRoleChange(user._id, user.role)}
                          disabled={loading}
                            className="px-3 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded"
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          disabled={loading}
                            className="ml-2 px-3 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination for Users */}
          {totalUsers > 0 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={totalUsers}
              limit={usersPerPage}
              onPageChange={(p) => fetchUsers(p, filters.search)}
              label="users"
            />
          )}
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'logs' && (
        <div>
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={filters.action}
                  onChange={handleFiltersChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                >
                  <option value="">All Actions</option>
                  {logActions.map(action => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <select
                  value={filters.userId}
                  onChange={handleFiltersChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                >
                  <option value="">All Users</option>
                  {logUsers.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                />
              </div>
            </div>
            <button
              onClick={exportLogs}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[140px]"
            >
              <span>Export Logs</span>
            </button>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {loading ? (
              <div className="p-6 text-center">
                <div className="flex space-x-3 justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary self-center">Loading logs...</span>
                </div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p>No logs found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                {filteredLogs.map((log) => (
                  <div key={log._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{log.userId?.username || 'Unknown User'}</h3>
                        <p className="text-sm text-gray-500 truncate">{log.details || '-'}</p>
                      </div>
                      <span className={`flex-shrink-0 px-2 py-1 text-xs font-bold rounded-full ${
                        log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'LOGOUT' ? 'bg-gray-100 text-gray-700' :
                        log.action.startsWith('CREATE') || log.action.startsWith('UPDATE') || log.action.startsWith('DELETE') ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center">
                      Loading logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.userId?.username || 'Unknown User'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.action === 'LOGIN' ? 'bg-blue-100 text-blue-800' : log.action === 'LOGOUT' ? 'bg-gray-100 text-gray-800' : log.action.startsWith('CREATE') || log.action.startsWith('UPDATE') || log.action.startsWith('DELETE') ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="max-w-[240px] truncate" title={log.details || '-'}>
                          {log.details || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination for Logs */}
          {totalLogs > 0 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={totalLogs}
              limit={logsPerPage}
              onPageChange={fetchUserLogs}
              label="logs"
            />
          )}
        </div>
      )}

      {/* Marketing Executives Tab */}
      {activeTab === 'executives' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search marketing executives..."
                  value={execSearch}
                  onChange={(e) => {
                    setExecSearch(e.target.value);
                    setExecCurrentPage(1);
                    fetchExecutives(1, e.target.value, execIsActiveFilter);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                />
              </div>
              <div className="flex-1 sm:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={execIsActiveFilter}
                  onChange={(e) => {
                    setExecIsActiveFilter(e.target.value);
                    setExecCurrentPage(1);
                    fetchExecutives(1, execSearch, e.target.value);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => setShowExecCreateModal(true)}
              className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px] min-w-[140px]"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add New Executive</span>
            </button>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {loading ? (
              <div className="p-6 text-center">
                <div className="flex space-x-3 justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary self-center">Loading executives...</span>
                </div>
              </div>
            ) : executives.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p>No marketing executives found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                {executives.map((exec) => (
                  <div key={exec._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{exec.name}</h3>
                      </div>
                      <span className={`flex-shrink-0 px-2 py-1 text-xs font-bold rounded-full ${exec.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {exec.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleEditExecutive(exec)}
                        disabled={loading}
                        className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                      >
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteExecutive(exec._id)}
                        disabled={loading}
                        className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 touch-manipulation min-h-[44px] transition-colors disabled:opacity-50"
                      >
                        <span className="text-sm font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center">
                      Loading marketing executives...
                    </td>
                  </tr>
                ) : executives.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                      No marketing executives found
                    </td>
                  </tr>
                ) : (
                  executives.map((exec) => (
                    <tr key={exec._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {exec.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${exec.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {exec.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(exec.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditExecutive(exec)}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded"
                        >
                          <EditIcon className="w-3 h-3 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExecutive(exec._id)}
                          disabled={loading}
                          className="ml-2 px-3 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination for Executives */}
          {execTotal > 0 && (
            <Pagination
              page={execCurrentPage}
              totalPages={execTotalPages}
              total={execTotal}
              limit={20}
              onPageChange={(p) => fetchExecutives(p, execSearch, execIsActiveFilter)}
              label="executives"
            />
          )}
        </div>
      )}

      {/* Archived Books Tab */}
      {activeTab === 'books' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1">
              <input
                type="text"
                placeholder="Search archived books..."
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  setBookCurrentPage(1);
                  fetchArchivedBooks(1, e.target.value);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
              />
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {loading ? (
              <div className="p-6 text-center">
                <div className="flex space-x-3 justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary self-center">Loading archived books...</span>
                </div>
              </div>
            ) : archivedBooks.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-gray-400" />
                </div>
                <p>No archived books found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                {archivedBooks.map((book) => (
                  <div key={book.ISBN} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{book.TITLE}</h3>
                        <p className="text-sm text-gray-500">by {book.AUTHOR || 'Unknown Author'}</p>
                      </div>
                      <span className="flex-shrink-0 px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-700">
                        Archived
                      </span>
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
                        <span className="font-medium text-gray-900 ml-1">₱{Number(book.PRICE || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRestoreBook(book.ISBN)}
                        disabled={loading}
                        className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Publisher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center">
                      Loading archived books...
                    </td>
                  </tr>
                ) : archivedBooks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                      No archived books found
                    </td>
                  </tr>
                ) : (
                  archivedBooks.map((book) => (
                    <tr key={book.ISBN} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{book.ISBN}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[300px]">{book.TITLE}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.AUTHOR || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.YEAR || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[200px]">{book.PUBLISHER || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{Number(book.PRICE || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleRestoreBook(book.ISBN)}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded"
                        >
                          <RotateCcw className="w-3 h-3 inline mr-1" />
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination for Archived Books */}
          {bookTotal > 0 && (
            <Pagination
              page={bookCurrentPage}
              totalPages={bookTotalPages}
              total={bookTotal}
              limit={20}
              onPageChange={(p) => fetchArchivedBooks(p, bookSearch)}
              label="archived books"
            />
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1 flex flex-col sm:flex-row gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-1">Active Sessions</h2>
            </div>
            <button
              onClick={handleRevokeAllSessions}
              disabled={sessionsLoading}
              className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[140px]"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="hidden sm:inline">Revoke All Sessions</span>
            </button>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            {sessionsLoading ? (
              <div className="p-6 text-center">
                <div className="flex space-x-3 justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary self-center">Loading sessions...</span>
                </div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="w-6 h-6 text-gray-400" />
                </div>
                <p>No active sessions found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                {sessions.map((session) => (
                  <div key={session._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{session.userAgent || 'Unknown Device'}</h3>
                        <p className="text-sm text-gray-500 truncate">{session.ipAddress || 'Unknown IP'}</p>
                      </div>
                      <span className="flex-shrink-0 px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                        Active
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <span className="text-gray-900 ml-1">{new Date(session.createdAt).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Used:</span>
                        <span className="text-gray-900 ml-1">{new Date(session.lastUsedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRevokeSession(session._id)}
                        disabled={sessionsLoading}
                        className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device / Browser</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessionsLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center">
                      Loading sessions...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      No active sessions found
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-[300px]">{session.userAgent || 'Unknown Device'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{session.ipAddress || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(session.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(session.lastUsedAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleRevokeSession(session._id)}
                          disabled={sessionsLoading}
                          className="px-3 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded"
                        >
                          <RotateCcw className="w-3 h-3 inline mr-1" />
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>

    {/* Create User Modal */}
    {showCreateModal && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
        <div className="relative mx-auto my-8 sm:mt-10 w-full max-w-md sm:max-w-lg bg-white rounded-xl shadow-xl sm:rounded-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
            <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-500 hover:text-gray-700 touch-manipulation min-h-[44px] min-w-[44px]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                placeholder="Username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                placeholder="Min 6 characters"
                minLength="6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
              >
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 touch-manipulation min-h-[44px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px] transition-colors"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Create Marketing Executive Modal */}
    {showExecCreateModal && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black/50" onClick={() => setShowExecCreateModal(false)} />
        <div className="relative mx-auto my-8 sm:mt-10 w-full max-w-md sm:max-w-lg bg-white rounded-xl shadow-xl sm:rounded-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Create Marketing Executive</h2>
            <button onClick={() => setShowExecCreateModal(false)} className="p-2 text-gray-500 hover:text-gray-700 touch-manipulation min-h-[44px] min-w-[44px]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreateExecutive} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newExecutive.name}
                onChange={(e) => setNewExecutive(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                placeholder="Marketing Executive Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={newExecutive.isActive ? 'true' : 'false'}
                onChange={(e) => setNewExecutive(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowExecCreateModal(false)}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 touch-manipulation min-h-[44px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px] transition-colors"
              >
                {loading ? 'Creating...' : 'Create Executive'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Edit Marketing Executive Modal */}
    {showExecEditModal && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black/50" onClick={() => { setShowExecEditModal(false); setEditingExecutive(null); setNewExecutive({ name: '', isActive: true }); }} />
        <div className="relative mx-auto my-8 sm:mt-10 w-full max-w-md sm:max-w-lg bg-white rounded-xl shadow-xl sm:rounded-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Edit Marketing Executive</h2>
            <button onClick={() => { setShowExecEditModal(false); setEditingExecutive(null); setNewExecutive({ name: '', isActive: true }); }} className="p-2 text-gray-500 hover:text-gray-700 touch-manipulation min-h-[44px] min-w-[44px]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleUpdateExecutive} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newExecutive.name}
                onChange={(e) => setNewExecutive(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
                placeholder="Marketing Executive Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={newExecutive.isActive ? 'true' : 'false'}
                onChange={(e) => setNewExecutive(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[44px] text-base"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowExecEditModal(false); setEditingExecutive(null); setNewExecutive({ name: '', isActive: true }); }}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 touch-manipulation min-h-[44px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px] transition-colors"
              >
                {loading ? 'Updating...' : 'Update Executive'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminPanel;