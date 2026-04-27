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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

      if (result.success) {
        // Generate NPCs for the user
        await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate_npcs', email: user.email }),
        });
        
        setMessage('Family profile saved!');
        
        // Auto-redirect to game after short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        setLoading(false);
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to save profile');
    }
  };

  const handleDeleteFamilyInfo = async () => {
    if (!user?.email || deleting) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_family_info', email: user.email }),
      });
      const result = await response.json();

      if (result.success) {
        // Clear local form
        setFormData({
          familyName: '',
          title: '',
          gender: '',
          sexualPreference: ''
        });
        setMessage('Family info deleted');
        setShowDeleteConfirm(false);
        
        // Redirect to game
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        setMessage(result.message);
        setDeleting(false);
      }
    } catch (error) {
      setMessage('Failed to delete family info');
      setDeleting(false);
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

          {formData.familyName && (
            <button 
              onClick={() => setShowDeleteConfirm(true)} 
              style={{ 
                marginTop: '1.5rem', 
                width: '100%', 
                padding: '0.75rem',
                background: '#4a1515',
                border: '1px solid #6a2020',
                color: '#ff9999',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                cursor: 'pointer',
                borderRadius: '2px'
              }}
            >
              Delete Family Info
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #444',
              padding: '2rem',
              maxWidth: '400px',
              textAlign: 'center'
            }}>
              <h2 style={{ color: '#ff6666', marginTop: 0 }}>Delete Family Info?</h2>
              <p style={{ color: '#888', marginBottom: '1.5rem' }}>
                Warning: Deleting your Family Info will result in complete loss of all game information and progress. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  onClick={handleDeleteFamilyInfo}
                  disabled={deleting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#4a1515',
                    border: '1px solid #6a2020',
                    color: '#ff9999',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    borderRadius: '2px'
                  }}
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#333',
                    border: '1px solid #444',
                    color: '#e0e0e0',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    borderRadius: '2px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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