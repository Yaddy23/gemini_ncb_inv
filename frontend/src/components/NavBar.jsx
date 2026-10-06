import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, LogIn, LogOut, User, Plus, Barcode, ShoppingBag, Settings, Loader } from 'lucide-react';

const NavBar = ({ user, onLogout }) => {
  return (
    <nav className="fixed left-0 top-0 h-screen w-64 bg-white border-r shadow-lg z-50">
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Menu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-primary">BookInventory</h2>
            <p className="text-xs text-gray-500">Management System</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link to="/" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50">
                <Barcode className="w-5 h-5" />
                <span>Scan Books</span>
              </Link>
            </li>
            <li>
              <Link to="/books" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50">
                <ShoppingBag className="w-5 h-5" />
                <span>Book Catalog</span>
              </Link>
            </li>
            {user.role === 'Admin' && (
              <>
                <li>
                  <Link to="/import-export" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50">
                    <Plus className="w-5 h-5" />
                    <span>Import/Export</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50">
                    <Settings className="w-5 h-5" />
                    <span>Admin Panel</span>
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link to="/profile" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50">
                <User className="w-5 h-5" />
                <span>Profile</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className="pt-4 pb-2 border-t">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-md"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;