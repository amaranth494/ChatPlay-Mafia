'use client';

import { useState } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const [mode, setMode] = useState<'select' | 'email' | 'sms'>('select');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSendEmailOtp = async () => {
    if (!email) return;
    
    setLoading(true);
    setMessage('');
    setShowRegister(false);
    
    try {
      // First check if there's an unverified user with this email
      const checkResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login_check', email }),
      });
      const checkResult = await checkResponse.json();
      
      // If unverified user was found and deleted, redirect to registration
      if (checkResult.message === 'unverified_user' && checkResult.deleted) {
        setLoading(false);
        setMessage('Account not verified. Please complete registration.');
        setShowRegister(true);
        return;
      }
      
      // Proceed with normal login
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp_email', email }),
      });
      const result = await response.json();
      
      setLoading(false);
      
      if (result.success) {
        setMessage(`Code sent to ${email}`);
        // Store userId and email for verification
        sessionStorage.setItem('pending_email', email);
        if (result.userId) {
          sessionStorage.setItem('pending_user_id', result.userId.toString());
        }
        window.location.href = '/verify';
      } else {
        setMessage('Email not found. Please register below.');
        setShowRegister(true);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to send verification code');
    }
  };

  const handleSendSmsOtp = async () => {
    if (!phone) return;
    
    setLoading(true);
    setMessage('');
    setShowRegister(false);
    
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp_sms', phone }),
      });
      const result = await response.json();
      
      setLoading(false);
      
      if (result.success) {
        setMessage(`Code sent to ${phone}`);
        sessionStorage.setItem('pending_phone', phone);
        if (result.userId) {
          sessionStorage.setItem('pending_user_id', result.userId.toString());
        }
        window.location.href = '/verify';
      } else {
        setMessage('Phone number not found. Please register below.');
        setShowRegister(true);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Failed to send verification code');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1>ChatPlay Mafia</h1>
        
        {mode === 'select' && (
          <div className={styles.options}>
            <p className={styles.subtitle}>Welcome. Choose your path.</p>
            
            <button onClick={() => setMode('email')} className={styles.button}>
              Continue with Email
            </button>
            
            <button onClick={() => setMode('sms')} className={styles.button}>
              Continue with SMS
            </button>
          </div>
        )}

        {mode === 'email' && (
          <div className={styles.options}>
            <p className={styles.subtitle}>Enter your email for verification</p>
            
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMessage(''); setShowRegister(false); }}
              className={styles.input}
              autoFocus
            />
            
            <button 
              onClick={handleSendEmailOtp} 
              className={styles.button}
              disabled={!email || loading}
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
            
            <button onClick={() => setMode('select')} className={styles.backButton}>
              Back
            </button>
          </div>
        )}

        {mode === 'sms' && (
          <div className={styles.options}>
            <p className={styles.subtitle}>Enter your phone number for verification</p>
            
            <input
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setMessage(''); setShowRegister(false); }}
              className={styles.input}
              autoFocus
            />
            
            <p className={styles.smsDisclaimer}>
              By continuing, you agree to receive text messages. Standard carrier rates may apply.
            </p>
            
            <button 
              onClick={handleSendSmsOtp} 
              className={styles.button}
              disabled={!phone || loading}
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
            
            <button onClick={() => setMode('select')} className={styles.backButton}>
              Back
            </button>
          </div>
        )}

        {message && <p className={styles.message}>{message}</p>}
        
        {showRegister && (
          <div className={styles.registerPrompt}>
            <p className={styles.registerPromptText}>
              The {mode === 'sms' ? 'phone number' : 'email'} you entered isn&apos;t registered. Please enter a different {mode === 'sms' ? 'number' : 'email'} or click Register below if you&apos;re a New User.
            </p>
            <a href="/register">
              <button className={styles.registerButton}>
                Register
              </button>
            </a>
          </div>
        )}
        
        <div className={styles.footer}>
          <a href="/privacy-policy" className={styles.footerLink}>Privacy Policy</a>
          <span className={styles.footerDivider}>|</span>
          <a href="/terms" className={styles.footerLink}>Terms of Service</a>
        </div>
      </div>
    </div>
  );
}