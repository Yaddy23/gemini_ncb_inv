import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { User, Loader, Edit, Lock } from 'lucide-react';
import { AlertBanner, Button } from '../components/ui';

const Profile = ({ user, onLogin, onLogout }) => {
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
  const { toast } = useToast();

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
      toast.success('Profile updated successfully!');
      // Update local user state
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Za-z]/.test(passwordData.newPassword) || !/\d/.test(passwordData.newPassword)) {
      setError('Password must contain at least one letter and one number');
      toast.error('Password must contain at least one letter and one number');
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
      setShowPasswordChange(false);
      toast.success('Password changed successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout?.();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center space-x-3">
          <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          User Profile
        </h1>
        <p className="mt-2 text-gray-600">Manage your account settings</p>
      </div>

      {/* Profile Info Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Account Information</h2>

        {editMode ? (
          <form onSubmit={(e) => {
            e.preventDefault();
            handleUpdateProfile();
          }} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={profileData.username}
                onChange={handleProfileChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
              />
            </div>

            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Role:</label>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                profileData.role === 'Admin' ? 'bg-primary/20 text-primary' : 'bg-green-100 text-green-700'
              }`}>
                {profileData.role}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-4 sm:mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                size="touch"
                type="button"
                onClick={() => setEditMode(false)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="touch"
                type="submit"
                loading={loading}
                className="flex-1 sm:flex-none"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center space-x-3 sm:space-x-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">Username</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{profileData.username}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Edit className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{profileData.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">Role</p>
                <p className={`text-lg sm:text-xl font-bold ${
                  profileData.role === 'Admin' ? 'text-primary' : 'text-green-600'
                }`}>
                  {profileData.role}
                </p>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                variant="primary"
                size="touch"
                onClick={() => setEditMode(true)}
                className="flex-1"
              >
                <Edit className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                Edit Profile
              </Button>

              <Button
                variant="secondary"
                size="touch"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="flex-1"
              >
                <Lock className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                Change Password
              </Button>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {error && <div className="mt-4"><AlertBanner tone="error">{error}</AlertBanner></div>}

        {success && <div className="mt-4"><AlertBanner tone="success">{success}</AlertBanner></div>}
      </div>

      {/* Password Change Section */}
      {showPasswordChange && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Change Password</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
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
                minLength="8"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
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
                minLength="8"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation min-h-[44px] text-base"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-4 sm:mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                size="touch"
                type="button"
                onClick={() => setShowPasswordChange(false)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="touch"
                type="submit"
                loading={loading}
                className="flex-1 sm:flex-none"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </form>

          {/* Password Change Messages */}
          {error && <div className="mt-4"><AlertBanner tone="error">{error}</AlertBanner></div>}

          {success && <div className="mt-4"><AlertBanner tone="success">{success}</AlertBanner></div>}
        </div>
      )}
    </div>
  );
};

export default Profile;