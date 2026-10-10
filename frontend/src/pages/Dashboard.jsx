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
      <div className="p-4 sm:p-6">
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
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg">
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
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center space-x-3">
          <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Dashboard Overview
        </h1>
        <p className="mt-2 text-gray-600">Welcome back, {user.username}! Here's your inventory overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Books */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-medium text-gray-500 truncate">Total Book Titles</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.totalBooks}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-medium text-gray-500 truncate">Total Units in Stock</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.totalQuantity}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <ScanBarcode className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Today's Transactions */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-medium text-gray-500 truncate">Today's Transactions</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.todayTransactions}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 sm:mt-8">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <button
            onClick={() => window.location.href = '/scan'}
            className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex items-center justify-between border border-gray-100 touch-manipulation min-h-[48px]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-medium text-gray-700 truncate">Scan Books</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Use barcode scanner or camera</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <ScanBarcode className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </button>

          <button
            onClick={() => window.location.href = '/books'}
            className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex items-center justify-between border border-gray-100 touch-manipulation min-h-[48px]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base font-medium text-gray-700 truncate">Manage Books</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">View and edit book catalog</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </button>

          {user.role === 'Admin' && (
            <button
              onClick={() => window.location.href = '/import-export'}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex items-center justify-between border border-gray-100 touch-manipulation min-h-[48px]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-medium text-gray-700 truncate">Import/Export</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Bulk operations</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;