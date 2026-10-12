import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  ScanBarcode, ShoppingBag, Plus, Users, Loader, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, Package, SlidersHorizontal, Activity
} from 'lucide-react';
import StockMovementChart from '../components/dashboard/StockMovementChart';

// Feed icon + tint per action; inbound/outbound reuse the chart's series
// colors so the two views read as the same entities
const ACTION_STYLES = {
  INBOUND: { icon: ArrowDownCircle, color: '#2a78d6' },
  OUTBOUND: { icon: ArrowUpCircle, color: '#eb6834' },
  ADJUSTMENT: { icon: SlidersHorizontal, color: '#6b7280' },
  BULK_IMPORT: { icon: Package, color: '#6b7280' },
};

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

const RecentActivity = ({ transactions }) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center">
        <p className="text-sm text-gray-400">No recent stock activity</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {transactions.map(t => {
        const style = ACTION_STYLES[t.action] || ACTION_STYLES.ADJUSTMENT;
        const Icon = style.icon;
        const qty = t.qtyChanged > 0 ? `+${t.qtyChanged}` : `${t.qtyChanged}`;
        return (
          <li key={t._id} className="flex items-start space-x-3 py-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ color: style.color, backgroundColor: `${style.color}1A` }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 truncate">
                <span className="font-medium">{t.title || t.ISBN}</span>
                <span className="ml-2 font-semibold">{qty}</span>
              </p>
              <p className="text-xs text-gray-500 truncate">
                {t.action === 'BULK_IMPORT' ? 'Bulk import' : t.action === 'ADJUSTMENT' ? 'Adjustment' : t.action.charAt(0) + t.action.slice(1).toLowerCase()}
                {' · '}
                {t.performedBy?.username || 'Unknown'}
                {' · '}
                {timeAgo(t.createdAt)}
              </p>
            </div>
            <p className="text-xs text-gray-400 flex-shrink-0 pt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
              QTY {t.newQty}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalQuantity: 0,
    todayTransactions: 0
  });
  const [outOfStock, setOutOfStock] = useState({ books: [], count: 0 });
  const [movement, setMovement] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [statsResponse, outOfStockResponse, summaryResponse, recentResponse] = await Promise.all([
          api.get('/books/stats'),
          api.get('/books/out-of-stock'),
          api.get('/stock/summary', { params: { days: 14 } }),
          api.get('/stock/recent', { params: { limit: 12 } })
        ]);

        setStats({
          totalBooks: statsResponse.data.totalBooks,
          totalQuantity: statsResponse.data.totalQuantity,
          todayTransactions: statsResponse.data.todayTransactions
        });
        setOutOfStock({
          books: outOfStockResponse.data.books || [],
          count: outOfStockResponse.data.count || 0
        });
        setMovement(summaryResponse.data.perDay || []);
        setRecent(recentResponse.data.transactions || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
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

        {/* Out of Stock */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-medium text-gray-500 truncate">Out of Stock Titles</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{outOfStock.count}</p>
              {outOfStock.count === 0 ? (
                <p className="text-xs sm:text-sm text-green-600 mt-1">No out of stock items</p>
              ) : (
                <button
                  onClick={() => setShowOutOfStockModal(true)}
                  className="mt-2 px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90"
                >
                  View Details
                </button>
              )}
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Stock movement chart + recent activity */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <StockMovementChart data={movement} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
          </div>
          <RecentActivity transactions={recent} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 sm:mt-8">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/scan')}
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
            onClick={() => navigate('/books')}
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
              onClick={() => navigate('/import-export')}
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
          {/* Out of Stock Modal */}
          {showOutOfStockModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-50">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Out of Stock Books</h3>
                  <button
                    onClick={() => setShowOutOfStockModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
                {outOfStock.books.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {outOfStock.books.map((book) => (
                      <li key={book.ISBN} className="flex items-start space-x-3 py-2">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#eb68341A' }}>
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">
                            <span className="font-medium">{book.TITLE}</span>
                            <span className="ml-2 text-gray-500">ISBN: {book.ISBN}</span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No out of stock books</p>
                )}
              </div>
            </div>
          )}
    </div>
  );
};

export default Dashboard;
