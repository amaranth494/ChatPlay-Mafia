'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem('pending_user_id');
    const storedEmail = sessionStorage.getItem('pending_email');
    const storedPhone = sessionStorage.getItem('pending_phone');
    
    if (storedUserId) {
      setUserId(parseInt(storedUserId));
    }
    setEmail(storedEmail);
    setPhone(storedPhone);
    
    if (!storedUserId && !storedEmail && !storedPhone) {
      router.push('/login');
    }
  }, [router]);

  const handleVerify = async () => {
    if (!userId || !code) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', userId, code }),
      });
      const result = await response.json();
      
      setLoading(false);
      
      if (result.success) {
        // Clear session storage
        sessionStorage.removeItem('pending_user_id');
        sessionStorage.removeItem('pending_email');
        sessionStorage.removeItem('pending_phone');
        
        // Store user session
        const userData = { 
          id: result.userId, 
          email: email || null, 
          phone: phone || null 
        };
        localStorage.setItem('chatplay_user', JSON.stringify(userData));
        
        setMessage('Verified! Redirecting...');
        window.location.href = '/';
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setLoading(false);
      setMessage('Verification failed');
    }
  };

  const handleResend = async () => {
    setCode('');
    setMessage('');
    
    if (email) {
      window.location.href = '/login';
    } else if (phone) {
      window.location.href = '/login';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1>Verify</h1>
        
        <div className={styles.options}>
          <p className={styles.subtitle}>Enter the 6-digit code</p>
          <p className={styles.hint}>
            Sent to: {email || phone}
          </p>
          
          <input
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={styles.inputOtp}
            maxLength={6}
            autoFocus
          />
          
          <button 
            onClick={handleVerify} 
            className={styles.button}
            disabled={code.length !== 6 || loading}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          
          <button 
            onClick={handleResend} 
            className={styles.resendButton}
          >
            Resend Code
          </button>
          
          <button onClick={() => router.push('/login')} className={styles.backButton}>
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