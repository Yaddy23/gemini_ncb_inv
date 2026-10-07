import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogIn, LogOut, User, Plus, Barcode, ShoppingBag, Settings, Loader, LayoutDashboard, X, FileText, Receipt } from 'lucide-react';

const NavBar = ({ user, onLogout, collapsed, onToggle, isMobile, isOpen, onClose }) => {
  const location = useLocation();
  const prevLocationRef = React.useRef(location);

  // Close mobile menu on navigation (route change)
  React.useEffect(() => {
    if (isMobile && isOpen && location !== prevLocationRef.current) {
      onClose();
    }
    prevLocationRef.current = location;
  }, [location, isMobile, isOpen, onClose]);

  // Don't render if mobile and not open
  if (isMobile && !isOpen) {
    return null;
  }

  const sidebarClasses = isMobile
    ? 'fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r shadow-xl z-50 transform transition-transform duration-300 ease-in-out'
    : `fixed left-0 top-0 h-screen bg-white border-r shadow-lg z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`;

  return (
    <nav className={sidebarClasses}>
      <div className="flex flex-col h-full p-4">
        {/* Header - only show on desktop or when not collapsed */}
        {!isMobile && (
          <div className="flex items-center space-x-3 mb-6">
            <button
              onClick={onToggle}
              className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Menu className="w-5 h-5 text-primary" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 transition-opacity duration-200">
                  <h2 className="font-semibold text-primary truncate">BookInventory</h2>
                  <p className="text-xs text-gray-500 truncate">Management System</p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Mobile Header with Close Button */}
        {isMobile && (
          <div className="flex items-center justify-between mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Menu className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-primary">BookInventory</h2>
              <p className="text-xs text-gray-500">Management System</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link
                to="/"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                onClick={isMobile ? onClose : undefined}
              >
                <Barcode className="w-5 h-5 flex-shrink-0" />
                {!isMobile && !collapsed && <span className="transition-opacity duration-200">Scan Books</span>}
                {isMobile && <span className="ml-3">Scan Books</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/books"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                onClick={isMobile ? onClose : undefined}
              >
                <ShoppingBag className="w-5 h-5 flex-shrink-0" />
                {!isMobile && !collapsed && <span className="transition-opacity duration-200">Book Catalog</span>}
                {isMobile && <span className="ml-3">Book Catalog</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/import-export"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                onClick={isMobile ? onClose : undefined}
              >
                <Plus className="w-5 h-5 flex-shrink-0" />
                {!isMobile && !collapsed && <span className="transition-opacity duration-200">Import/Export</span>}
                {isMobile && <span className="ml-3">Import/Export</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/delivery-receipts"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                onClick={isMobile ? onClose : undefined}
              >
                <Receipt className="w-5 h-5 flex-shrink-0" />
                {!isMobile && !collapsed && <span className="transition-opacity duration-200">Delivery Receipts</span>}
                {isMobile && <span className="ml-3">Delivery Receipts</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/sales-invoices"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                onClick={isMobile ? onClose : undefined}
              >
                <FileText className="w-5 h-5 flex-shrink-0" />
                {!isMobile && !collapsed && <span className="transition-opacity duration-200">Sales Invoices</span>}
                {isMobile && <span className="ml-3">Sales Invoices</span>}
              </Link>
            </li>
            {user.role === 'Admin' && (
              <li>
                <Link
                  to="/admin"
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                  onClick={isMobile ? onClose : undefined}
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  {!isMobile && !collapsed && <span className="transition-opacity duration-200">Admin Panel</span>}
                  {isMobile && <span className="ml-3">Admin Panel</span>}
                </Link>
              </li>
            )}
            <li>
              <Link
                to="/profile"
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                onClick={isMobile ? onClose : undefined}
              >
                <User className="w-5 h-5 flex-shrink-0" />
                {!isMobile && !collapsed && <span className="transition-opacity duration-200">Profile</span>}
                {isMobile && <span className="ml-3">Profile</span>}
              </Link>
            </li>
          </ul>
        </div>

        <div className="pt-4 pb-2 border-t">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-md group"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isMobile && !collapsed && <span className="transition-opacity duration-200">Logout</span>}
            {isMobile && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;