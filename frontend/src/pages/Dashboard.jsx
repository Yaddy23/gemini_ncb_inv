import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { ScanBarcode, ShoppingBag, Plus, Users, Loader, AlertTriangle, CheckCircle } from 'lucide-react';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalQuantity: 0,
    todayTransactions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await api.get('/books/stats');

        setStats({
          totalBooks: response.data.totalBooks,
          totalQuantity: response.data.totalQuantity,
          todayTransactions: response.data.todayTransactions
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex space-x-3">
            <Loader className="w-8 h-8 text-primary animate-spin" />
            <span className="text-primary">Loading dashboard...</span>
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
          Dashboard Overview
        </h1>
        <p className="mt-2 text-gray-600">Welcome back, {user.username}! Here's your inventory overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Books */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Book Titles</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBooks}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Units in Stock</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalQuantity}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ScanBarcode className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Today's Transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Transactions</p>
              <p className="text-3xl font-bold text-gray-900">{stats.todayTransactions}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = '/scan'}
            className="bg-white rounded-lg shadow hover:shadow-md transition-all duration-200 p-6 flex items-center justify-between"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Scan Books</p>
              <p className="text-xs text-gray-500">Use ScanBarcode scanner or camera</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center ml-4">
              <ScanBarcode className="w-5 h-5 text-primary" />
            </div>
          </button>

          <button
            onClick={() => window.location.href = '/books'}
            className="bg-white rounded-lg shadow hover:shadow-md transition-all duration-200 p-6 flex items-center justify-between"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Manage Books</p>
              <p className="text-xs text-gray-500">View and edit book catalog</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center ml-4">
              <Plus className="w-5 h-5 text-primary" />
            </div>
          </button>

          {user.role === 'Admin' && (
            <button
              onClick={() => window.location.href = '/import-export'}
              className="bg-white rounded-lg shadow hover:shadow-md transition-all duration-200 p-6 flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Import/Export</p>
                <p className="text-xs text-gray-500">Bulk operations</p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center ml-4">
                <Plus className="w-5 h-5 text-primary" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;