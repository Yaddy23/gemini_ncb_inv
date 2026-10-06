import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { User, CheckCircle, AlertTriangle, Loader, Edit, Lock } from 'lucide-react';

const Profile = ({ user, onLogin }) => {
  const [profileData, setProfileData] = useState({
    username: user.username,
    email: user.email,
    role: user.role
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get('/auth/me');
        setProfileData({
          username: response.data.username,
          email: response.data.email,
          role: response.data.role
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.put('/auth/profile', profileData);
      setEditMode(false);
      setSuccess('Profile updated successfully!');

      // Update local storage if token needs refresh
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        onLogin(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setSuccess('Password changed successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogin(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
          <User className="w-5 h-5 text-primary" />
          User Profile
        </h1>
        <p className="mt-2 text-gray-600">Manage your account settings</p>
      </div>

      {/* Profile Info Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Account Information</h2>

        {editMode ? (
          <form onSubmit={(e) => {
            e.preventDefault();
            handleUpdateProfile();
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={profileData.username}
                onChange={handleProfileChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={profileData.email}
                onChange={handleProfileChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Role:</label>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                profileData.role === 'Admin' ? 'bg-primary/20 text-primary' : 'bg-green/20 text-green'
              }`}>
                {profileData.role}
              </span>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Username</p>
                <p className="text-xl font-bold text-gray-900">{profileData.username}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Edit className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-xl font-bold text-gray-900">{profileData.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Role</p>
                <p className={`text-xl font-bold ${
                  profileData.role === 'Admin' ? 'text-primary' : 'text-green-600'
                }`}>
                  {profileData.role}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center space-x-3">
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                <Edit className="mr-2 w-4 h-4" />
                Edit Profile
              </button>

              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                <Lock className="mr-2 w-4 h-4" />
                Change Password
              </button>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Password Change Section */}
      {showPasswordChange && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                minLength="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
                minLength="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => setShowPasswordChange(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50 transition-colors"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>

          {/* Password Change Messages */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;