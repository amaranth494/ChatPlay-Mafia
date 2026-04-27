'use client';

import { useState } from 'react';
import styles from '../login/login.module.css';

interface RegisterData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

export default function RegisterPage() {
  const [mode, setMode] = useState<'form' | 'otp'>('form');
  const [data, setData] = useState<RegisterData>({
    email: '',
    phone: '',
    firstName: '',
    lastName: ''
  });
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const handleSubmitRegistration = async () => {
    if (!data.email || !data.firstName || !data.lastName) {
      setMessage('Email, first name, and last name are required');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // First check if there's an unverified user with this email and delete it
      const loginCheckResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login_check', email: data.email }),
      });
      const loginCheckResult = await loginCheckResponse.json();

      // Create user record
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_user', 
          email: data.email,
          phone: data.phone || null,
          firstName: data.firstName,
          lastName: data.lastName
        }),
      });
      const result = await response.json();

      setLoading(false);

      if (result.success) {
        setUserId(result.userId);
        setMode('otp');
        sessionStorage.setItem('pending_email', data.email);
        sessionStorage.setItem('pending_user_id', result.userId.toString());

        // Send OTP email for registration
        const otpResponse = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_otp_email_for_registration', email: data.email }),
        });
        const otpResult = await otpResponse.json();

        if (otpResult.success) {
          setMessage(`Verification code sent to ${data.email}`);
        } else {
          setMessage('User created but failed to send code. Try resending.');
        }
      } else {
        // If email already registered, check if verified
        if (result.message === 'Email already registered') {
          const checkResponse = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check_registration', email: data.email }),
          });
          const checkResult = await checkResponse.json();
          
          if (checkResult.profile?.verified) {
            // User already has an account, redirect to login
            window.location.href = '/login';
            return;
          }
        }
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Registration failed');
    }
  };

  const handleVerifyOtp = async () => {
    if (!userId || !otpCode) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', userId, code: otpCode }),
      });
      const result = await response.json();

      setLoading(false);

      if (result.success) {
        // Store user session
        const userData = { 
          id: result.userId, 
          email: data.email, 
          phone: data.phone || null 
        };
        localStorage.setItem('chatplay_user', JSON.stringify(userData));
        
        // Clear session storage
        sessionStorage.removeItem('pending_user_id');
        sessionStorage.removeItem('pending_email');
        
        // Redirect to main game
        window.location.href = '/';
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Verification failed');
    }
  };

  if (mode === 'otp') {
    return (
      <div className={styles.container}>
        <div className={styles.loginBox}>
          <h1>Verify Email</h1>
          
          <div className={styles.options}>
            <p className={styles.subtitle}>Enter the 6-digit code</p>
            <p className={styles.hint}>Sent to: {data.email}</p>
            
            <input
              type="text"
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={styles.inputOtp}
              maxLength={6}
              autoFocus
            />
            
            <button 
              onClick={handleVerifyOtp} 
              className={styles.button}
              disabled={otpCode.length !== 6 || loading}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            
            <button 
              onClick={handleSubmitRegistration} 
              className={styles.resendButton}
            >
              Resend Code
            </button>
            
            <button onClick={() => setMode('form')} className={styles.backButton}>
              Back
            </button>
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

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1>Register</h1>
        
        <div className={styles.options}>
          <p className={styles.subtitle}>Create your account</p>
          
          <input
            type="email"
            placeholder="Email (required)"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            className={styles.input}
          />
          
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            className={styles.input}
          />
          
          <input
            type="text"
            placeholder="First Name (required)"
            value={data.firstName}
            onChange={(e) => setData({ ...data, firstName: e.target.value })}
            className={styles.input}
          />
          
          <input
            type="text"
            placeholder="Last Name (required)"
            value={data.lastName}
            onChange={(e) => setData({ ...data, lastName: e.target.value })}
            className={styles.input}
          />

          <button 
            onClick={handleSubmitRegistration} 
            className={styles.button}
            disabled={loading}
            style={{ marginTop: '1rem' }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          
          <a href="/login">
            <button className={styles.backButton}>
              Back to Login
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