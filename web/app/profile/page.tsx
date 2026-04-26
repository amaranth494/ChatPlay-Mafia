'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import styles from '../login/login.module.css';

interface UserData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  familyName: string;
  title: string;
  gender: string;
  sexualPreference: string;
  registered: boolean;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [formData, setFormData] = useState<UserData>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    familyName: '',
    title: '',
    gender: '',
    sexualPreference: '',
    registered: false
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    
    if (user?.email) {
      loadProfile();
    }
  }, [isAuthenticated, isLoading, user?.email]);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_profile', email: user?.email }),
      });
      const result = await response.json();
      
      if (result.success && result.profile) {
        setFormData({
          email: result.profile.email || '',
          phone: result.profile.phone || '',
          firstName: result.profile.first_name || '',
          lastName: result.profile.last_name || '',
          familyName: result.profile.family_name || '',
          title: result.profile.title || '',
          gender: result.profile.gender || '',
          sexualPreference: result.profile.sexual_preference || '',
          registered: result.profile.registered || false
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleSaveAccount = async () => {
    if (!user?.email) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          email: user.email,
          phone: formData.phone,
          firstName: formData.firstName,
          lastName: formData.lastName
        }),
      });
      const result = await response.json();

      setLoading(false);

      if (result.success) {
        setMessage('Account saved successfully!');
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to save account');
    }
  };

  const handleSaveGameProfile = async () => {
    if (!user?.email) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          email: user.email,
          familyName: formData.familyName,
          title: formData.title,
          gender: formData.gender,
          sexualPreference: formData.sexualPreference
        }),
      });
      const result = await response.json();

      setLoading(false);

      if (result.success) {
        setMessage('Game profile saved successfully!');
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to save game profile');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.email) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account', email: user.email }),
      });
      const result = await response.json();

      setLoading(false);

      if (result.success) {
        logout();
        window.location.href = '/login';
      } else {
        setMessage(result.message);
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to delete account');
      setShowDeleteConfirm(false);
    }
  };

  const titles = ['Boss', 'Underboss', 'Capo', 'Soldato', 'Associate'];
  const genders = ['Male', 'Female', 'Other'];
  const sexualPreferences = ['Straight', 'Bisexual', 'Flexible'];

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.email) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginBox} style={{ maxWidth: '500px' }}>
        <h1>Your Profile</h1>
        
        <div className={styles.options}>
          <p className={styles.subtitle}>
            Manage your account and game information.
          </p>
          
          <div style={{ background: '#252525', padding: '1rem', marginTop: '1rem', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#666', fontSize: '0.75rem' }}>EMAIL (IMMUTABLE)</label>
            <input
              type="email"
              value={formData.email}
              disabled
              className={styles.input}
              style={{ opacity: 0.5 }}
            />
          </div>

          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>Phone</label>
          <input
            type="tel"
            placeholder="Add phone number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className={styles.input}
          />

          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>First Name</label>
          <input
            type="text"
            placeholder="First name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className={styles.input}
          />

          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>Last Name</label>
          <input
            type="text"
            placeholder="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className={styles.input}
          />

          <button 
            onClick={handleSaveAccount} 
            className={styles.button}
            disabled={loading}
            style={{ marginTop: '1.5rem' }}
          >
            {loading ? 'Saving...' : 'Save Account'}
          </button>

          <div style={{ borderTop: '1px solid #333', marginTop: '2rem', paddingTop: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'normal', marginBottom: '1rem', color: '#888' }}>GAME PROFILE</h3>
            
            <label style={{ display: 'block', color: '#888', fontSize: '0.875rem' }}>Family Name</label>
            <input
              type="text"
              placeholder="Your mafia family name"
              value={formData.familyName}
              onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
              className={styles.input}
            />

            <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>Your Title</label>
            <select
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={styles.input}
            >
              <option value="">Select title</option>
              {titles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>Gender</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className={styles.input}
            >
              <option value="">Select gender</option>
              {genders.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>Sexual Preference</label>
            <select
              value={formData.sexualPreference}
              onChange={(e) => setFormData({ ...formData, sexualPreference: e.target.value })}
              className={styles.input}
            >
              <option value="">Select preference</option>
              {sexualPreferences.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button 
              onClick={handleSaveGameProfile} 
              className={styles.button}
              disabled={loading}
              style={{ marginTop: '1.5rem' }}
            >
              {loading ? 'Saving...' : 'Save Game Profile'}
            </button>
          </div>

          <a href="/">
            <button 
              className={styles.backButton}
              style={{ display: 'block', marginTop: '1rem', width: '100%' }}
            >
              Back to Game
            </button>
          </a>
          
          <div style={{ borderTop: '1px solid #442222', marginTop: '2rem', paddingTop: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'normal', marginBottom: '1rem', color: '#aa4444' }}>DANGER ZONE</h3>
            
            {!showDeleteConfirm ? (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className={styles.button}
                style={{ background: '#442222', borderColor: '#663333', width: '100%' }}
              >
                Delete Account
              </button>
            ) : (
              <div style={{ background: '#331111', padding: '1rem', border: '1px solid #663333' }}>
                <p style={{ color: '#aa6666', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Are you sure? This will permanently delete your account and all data. This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={handleDeleteAccount}
                    className={styles.button}
                    style={{ background: '#882222', borderColor: '#aa3333', flex: 1 }}
                  >
                    {loading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className={styles.button}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {message && <p className={styles.message}>{message}</p>}
        
        <div className={styles.footer}>
          <a href="/privacy-policy" className={styles.footerLink}>Privacy Policy</a>
          <span className={styles.footerDivider}>|</span>
          <a href="/terms" className={styles.footerLink}>Terms of Service</a>
        </div>
      </div>
    </div>
  );
}