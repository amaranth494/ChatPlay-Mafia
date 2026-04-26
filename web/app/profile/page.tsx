'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import styles from '../login/login.module.css';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    familyName: '',
    title: '',
    gender: '',
    sexualPreference: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated, isLoading]);

  const handleSubmit = async () => {
    if (!user?.email) return;
    
    if (!formData.familyName || !formData.title || !formData.gender || !formData.sexualPreference) {
      setMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_registration',
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
        setMessage('Profile saved! Redirecting...');
        window.location.href = '/';
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to save profile');
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
      <div className={styles.loginBox}>
        <h1>Your Profile</h1>
        
        <div className={styles.options}>
          <p className={styles.subtitle}>
            Welcome, {user.email}. Set up your game profile to personalize your experience.
          </p>
          
          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>
            Family Name
          </label>
          <input
            type="text"
            placeholder="Your mafia family name"
            value={formData.familyName}
            onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
            className={styles.input}
          />

          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>
            Your Title
          </label>
          <select
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={styles.input}
          >
            <option value="">Select title</option>
            {titles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>
            Gender
          </label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className={styles.input}
          >
            <option value="">Select gender</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>
            Sexual Preference
          </label>
          <select
            value={formData.sexualPreference}
            onChange={(e) => setFormData({ ...formData, sexualPreference: e.target.value })}
            className={styles.input}
          >
            <option value="">Select preference</option>
            {sexualPreferences.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <button 
            onClick={handleSubmit} 
            className={styles.button}
            disabled={loading}
            style={{ marginTop: '2rem' }}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>

          <a href="/">
            <button 
              className={styles.backButton}
              style={{ display: 'block', marginTop: '1rem', width: '100%' }}
            >
              Skip for Now
            </button>
          </a>
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