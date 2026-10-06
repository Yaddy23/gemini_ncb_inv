import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, LogIn, LogOut, User, Plus, Barcode, ShoppingBag, Settings, Loader, LayoutDashboard } from 'lucide-react';

const NavBar = ({ user, onLogout, collapsed, onToggle }) => {
  return (
    <nav className={`fixed left-0 top-0 h-screen bg-white border-r shadow-lg z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex flex-col h-full p-4">
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

        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link to="/" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group">
                <Barcode className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="transition-opacity duration-200">Scan Books</span>}
              </Link>
            </li>
            <li>
              <Link to="/books" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group">
                <ShoppingBag className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="transition-opacity duration-200">Book Catalog</span>}
              </Link>
            </li>
            {user.role === 'Admin' && (
              <>
                <li>
                  <Link to="/import-export" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group">
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="transition-opacity duration-200">Import/Export</span>}
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group">
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="transition-opacity duration-200">Admin Panel</span>}
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link to="/profile" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 group">
                <User className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="transition-opacity duration-200">Profile</span>}
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
            {!collapsed && <span className="transition-opacity duration-200">Logout</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;