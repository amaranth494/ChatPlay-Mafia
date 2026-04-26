'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from '../login/login.module.css';

interface RegisterData {
  familyName: string;
  title: string;
  gender: string;
  sexualPreference: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [code, setCode] = useState('');
  const [data, setData] = useState<RegisterData>({
    familyName: '',
    title: '',
    gender: '',
    sexualPreference: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const userEmail = user?.email;

  if (!userEmail) {
    return (
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <h1>Registration Required</h1>
          <p className={styles.subtitle}>Please sign in first to register.</p>
          <a href="/login">
            <button className={styles.button}>Go to Login</button>
          </a>
        </div>
      </div>
    );
  }

  const handleRegister = async () => {
    if (!data.familyName || !data.title || !data.gender || !data.sexualPreference) {
      setMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Submit registration data
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_registration',
          email: userEmail,
          ...data
        })
      });
      const result = await response.json();
      
      if (result.success) {
        router.push('/');
      } else {
        setMessage(result.message || 'Registration failed');
      }
    } catch (error) {
      setMessage('Registration failed');
    }
    setLoading(false);
  };

  const titles = ['Boss', 'Underboss', 'Capo', 'Soldier', 'Associate'];
  const genders = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const sexualPreferences = ['Straight', 'Gay', 'Bisexual', 'Flexible', 'Prefer not to say'];

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1>Complete Registration</h1>
        
        <p className={styles.subtitle}>Welcome, {userEmail}</p>
        <p className={styles.hint}>Tell us about yourself to personalize your experience.</p>

        <div className={styles.options}>
          <label style={{ display: 'block', marginTop: '1rem' }}>Family Name</label>
          <input
            type="text"
            placeholder="Your family name"
            value={data.familyName}
            onChange={(e) => setData({ ...data, familyName: e.target.value })}
            className={styles.input}
          />

          <label style={{ display: 'block', marginTop: '1rem' }}>Your Title</label>
          <select
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            className={styles.input}
          >
            <option value="">Select title</option>
            {titles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={{ display: 'block', marginTop: '1rem' }}>Gender</label>
          <select
            value={data.gender}
            onChange={(e) => setData({ ...data, gender: e.target.value })}
            className={styles.input}
          >
            <option value="">Select gender</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <label style={{ display: 'block', marginTop: '1rem' }}>Sexual Preference</label>
          <select
            value={data.sexualPreference}
            onChange={(e) => setData({ ...data, sexualPreference: e.target.value })}
            className={styles.input}
          >
            <option value="">Select preference</option>
            {sexualPreferences.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <button 
            onClick={handleRegister} 
            className={styles.button}
            disabled={loading || !data.familyName || !data.title || !data.gender || !data.sexualPreference}
            style={{ marginTop: '2rem' }}
          >
            {loading ? 'Registering...' : 'Complete Registration'}
          </button>

          <a href="/">
            <button 
              className={styles.backButton}
              style={{ display: 'block', marginTop: '1rem' }}
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