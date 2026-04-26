'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import styles from '../login/login.module.css';

interface GameProfileData {
  familyName: string;
  title: string;
  gender: string;
  sexualPreference: string;
}

export default function FamilyInfoPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [formData, setFormData] = useState<GameProfileData>({
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
      return;
    }
    
    if (user?.email) {
      loadGameProfile();
    }
  }, [isAuthenticated, isLoading, user?.email]);

  const loadGameProfile = async () => {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_profile', email: user?.email }),
      });
      const result = await response.json();
      
      if (result.success && result.profile) {
        setFormData({
          familyName: result.profile.family_name || '',
          title: result.profile.title || '',
          gender: result.profile.gender || '',
          sexualPreference: result.profile.sexual_preference || ''
        });
      }
    } catch (error) {
      console.error('Failed to load game profile:', error);
    }
  };

  const handleSave = async () => {
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
        setMessage('Family profile saved!');
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
      <div className={styles.loginBox} style={{ maxWidth: '500px' }}>
        <h1>Family Info</h1>
        
        <div className={styles.options}>
          <p className={styles.subtitle}>
            Your character's family profile.
          </p>
          
          <label style={{ display: 'block', marginTop: '1rem', color: '#888', fontSize: '0.875rem' }}>Family Name</label>
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
            onClick={handleSave} 
            className={styles.button}
            disabled={loading}
            style={{ marginTop: '1.5rem' }}
          >
            {loading ? 'Saving...' : 'Save Family Info'}
          </button>

          <a href="/">
            <button 
              className={styles.backButton}
              style={{ display: 'block', marginTop: '1rem', width: '100%' }}
            >
              Back to Game
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