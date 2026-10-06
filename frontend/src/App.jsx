import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from './api/axios';

// Components
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import Scan from './pages/Scan';
import ImportExport from './pages/ImportExport';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import NavBar from './components/NavBar';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await api.get('/auth/me');
          setUser(response.data);
        }
      } catch (error) {
        // Token invalid or expired
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('token', userData.token);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {user && <NavBar user={user} onLogout={logout} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
        <main className={user ? (sidebarCollapsed ? 'ml-16' : 'ml-64') : 'ml-0'} style={{ transition: 'margin-left 0.3s ease' }}>
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/" replace /> : <Login onLogin={login} />}
            />
            <Route
              path="/"
              element={
                <PrivateRoute isAuthenticated={!!user}>
                  <Dashboard user={user} />
                </PrivateRoute>
              }
            />
            <Route
              path="/books"
              element={
                <PrivateRoute isAuthenticated={!!user}>
                  <Books user={user} />
                </PrivateRoute>
              }
            />
            <Route
              path="/scan"
              element={
                <PrivateRoute isAuthenticated={!!user}>
                  <Scan user={user} />
                </PrivateRoute>
              }
            />
            <Route
              path="/import-export"
              element={
                <PrivateRoute isAuthenticated={!!user && user.role === 'Admin'}>
                  <ImportExport user={user} />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute isAuthenticated={!!user}>
                  <Profile user={user} onLogin={login} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute isAuthenticated={!!user && user.role === 'Admin'}>
                  <AdminPanel user={user} />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;