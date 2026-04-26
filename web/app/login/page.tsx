'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import styles from './login.module.css';

export default function LoginPage() {
  const [mode, setMode] = useState<'select' | 'email' | 'sms' | 'otp' | 'passkey'>('select');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { loginWithEmail, loginWithSms, verifyOtp, loginWithPasskey, registerPasskey } = useAuth();

  const handleSendOtp = async () => {
    setLoading(true);
    setMessage('');
    
    let result;
    if (mode === 'email') {
      result = await loginWithEmail(email);
      if (result.userId) setUserId(result.userId);
    } else {
      result = await loginWithSms(phone);
      if (result.userId) setUserId(result.userId);
    }
    
    setLoading(false);
    
    if (result.success) {
      setMessage(result.message);
      setMode('otp');
    } else {
      setMessage(result.message);
    }
  };

  const handleVerifyOtp = async () => {
    if (!userId || !otpCode) return;
    
    setLoading(true);
    const result = await verifyOtp(userId, otpCode);
    setLoading(false);
    
    if (result.success) {
      setMessage('Verified! Redirecting...');
      // AuthProvider will handle the redirect
      window.location.href = '/';
    } else {
      setMessage(result.message);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!email) {
      setMessage('Please enter your email first');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    const result = await loginWithPasskey(email);
    setLoading(false);
    
    if (result.success) {
      setMessage('Authenticated! Redirecting...');
      window.location.href = '/';
    } else {
      setMessage(result.message);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!userId) return;
    
    setLoading(true);
    const result = await registerPasskey(userId);
    setLoading(false);
    
    if (result.success) {
      setMessage('Passkey registered! You can now use it to login.');
      window.location.href = '/';
    } else {
      setMessage(result.message);
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
            
            <div className={styles.divider}>
              <span>or</span>
            </div>
            
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
            
            <button 
              onClick={handlePasskeyLogin} 
              className={styles.buttonSecondary}
              disabled={!email}
            >
              Login with Passkey
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
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              autoFocus
            />
            
            <button 
              onClick={handleSendOtp} 
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
              onChange={(e) => setPhone(e.target.value)}
              className={styles.input}
              autoFocus
            />
            
            <p className={styles.smsDisclaimer}>
              By continuing, you agree to receive text messages. Standard carrier rates may apply.
            </p>
            
            <button 
              onClick={handleSendOtp} 
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

        {mode === 'otp' && (
          <div className={styles.options}>
            <p className={styles.subtitle}>Enter the 6-digit code</p>
            <p className={styles.hint}>Check your {email ? 'email' : 'phone'}</p>
            
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
              onClick={handleSendOtp} 
              className={styles.resendButton}
              disabled={loading}
            >
              Resend Code
            </button>
            
            <button onClick={() => setMode('select')} className={styles.backButton}>
              Back
            </button>
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