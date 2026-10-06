import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';

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
      const response = await axios.get(`/api/auth/users?page=${page}&limit=${usersPerPage}&search=${search}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
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

      const response = await axios.get(`/api/user-logs?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
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
        axios.get(`/api/user-logs/actions`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get(`/api/user-logs/users`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      setLogActions(actionsRes.data.actions);
      setLogUsers(usersRes.data.users);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setLoading(true);
      try {
        await axios.delete(`/api/auth/users/${userId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
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
      await axios.put(`/api/auth/users/${userId}`, {
        isActive: !isActive
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
      await axios.put(`/api/auth/users/${userId}`, {
        role: newRole
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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

      const response = await axios.get(`/api/user-logs/export?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });

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

  // Initialize data
  useEffect(() => {
    fetchUsers();
    fetchUserLogs();
    fetchFilterOptions();
  }, []);

  // Refetch when page changes
  useEffect(() => {
    if (users.length > 0) {
      fetchUsers(currentPage, filters.search);
    }
    if (userLogs.length > 0) {
      fetchUserLogs(currentPage);
    }
  }, [currentPage, filters]);

  if (!user || user.role !== 'Admin') {
    return <div className="p-6">Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-600">Manage users and view activity logs</p>
      </div>

      {/* Status Messages */}
      {error && <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">{success}</div>}

      {/* Tabs */}
      <div className="mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'} px-4 py-2 mr-2 rounded`}>
          User Management
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'} px-4 py-2 rounded`}>
          Activity Logs
        </button>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, search: e.target.value }));
                setCurrentPage(1); // Reset to first page
                fetchUsers(1, e.target.value);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="overflow-x-auto">
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
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * usersPerPage) + 1}-{Math.min(currentPage * usersPerPage, totalUsers)} of {totalUsers} users
              </div>
              <div>
                <button
                  onClick={() => currentPage > 1 && fetchUsers(currentPage - 1, filters.search)}
                  disabled={loading || currentPage === 1}
                  className="px-3 py-1 mr-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => currentPage < totalPages && fetchUsers(currentPage + 1, filters.search)}
                  disabled={loading || currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'logs' && (
        <div>
          <div className="mb-4">
            <div className="flex flex-wrap gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={filters.action}
                  onChange={handleFiltersChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Actions</option>
                  {logActions.map(action => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <select
                  value={filters.userId}
                  onChange={handleFiltersChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Users</option>
                  {logUsers.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={exportLogs}
                disabled={loading}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md flex items-center"
              >
                Export Logs
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                        {log.details || '-'}
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
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * logsPerPage) + 1}-{Math.min(currentPage * logsPerPage, totalLogs)} of {totalLogs} logs
              </div>
              <div>
                <button
                  onClick={() => currentPage > 1 && fetchUserLogs(currentPage - 1)}
                  disabled={loading || currentPage === 1}
                  className="px-3 py-1 mr-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => currentPage < totalPages && fetchUserLogs(currentPage + 1)}
                  disabled={loading || currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;