import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogOut, User, Plus, Barcode, ShoppingBag, Settings, X, FileText, Receipt, FilePlus } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Scan Books', icon: Barcode },
  { to: '/books', label: 'Book Catalog', icon: ShoppingBag },
  { to: '/import-export', label: 'Import/Export', icon: Plus, adminOnly: true },
  { to: '/evaluation-forms', label: 'Evaluation Forms', icon: FilePlus },
  { to: '/delivery-receipts', label: 'Delivery Receipts', icon: Receipt },
  { to: '/sales-invoices', label: 'Sales Invoices', icon: FileText },
  { to: '/admin', label: 'Admin Panel', icon: Settings, adminOnly: true },
  { to: '/profile', label: 'Profile', icon: User },
];

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
    ? 'fixed left-0 topbar-height h-[calc(100vh-4rem-env(safe-area-inset-top,0px))] w-64 bg-white border-r shadow-xl z-50 transform transition-transform duration-300 ease-in-out pt-safe'
    : `fixed left-0 top-0 h-screen bg-white border-r shadow-lg z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`;

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'Admin');

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
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group"
                  onClick={isMobile ? onClose : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isMobile && !collapsed && <span className="transition-opacity duration-200">{label}</span>}
                  {isMobile && <span className="ml-3">{label}</span>}
                </Link>
              </li>
            ))}
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
