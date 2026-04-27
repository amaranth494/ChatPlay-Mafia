'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: number;
  playerUuid: string;
  email: string | null;
  phone: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  loginWithEmail: (email: string) => Promise<{ success: boolean; message: string; userId?: number }>;
  loginWithSms: (phone: string) => Promise<{ success: boolean; message: string; userId?: number }>;
  verifyOtp: (userId: number, code: string) => Promise<{ success: boolean; message: string }>;
  loginWithPasskey: (email: string) => Promise<{ success: boolean; message: string }>;
  registerPasskey: (userId: number) => Promise<{ success: boolean; message: string; options?: any }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('chatplay_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('chatplay_user');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithEmail = async (email: string) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp_email', email }),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[Auth] Email login error:', error);
      return { success: false, message: 'Failed to send verification code' };
    }
  };

  const loginWithSms = async (phone: string) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp_sms', phone }),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[Auth] SMS login error:', error);
      return { success: false, message: 'Failed to send verification code' };
    }
  };

  const verifyOtp = async (userId: number, code: string) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', userId, code }),
      });
      const result = await response.json();
      
      if (result.success) {
        // Store user data with playerUuid
        const userData: User = { 
          id: userId, 
          playerUuid: result.playerUuid || '',
          email: null, 
          phone: null 
        };
        setUser(userData);
        localStorage.setItem('chatplay_user', JSON.stringify(userData));
      }
      
      return result;
    } catch (error) {
      console.error('[Auth] OTP verification error:', error);
      return { success: false, message: 'Verification failed' };
    }
  };

  const loginWithPasskey = async (email: string) => {
    try {
      // Get authentication options
      const optionsResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate_passkey_options', email }),
      });
      const optionsResult = await optionsResponse.json();
      
      if (!optionsResult.success) {
        return { success: false, message: optionsResult.error || 'Failed to get passkey options' };
      }

      // Use SimpleWebAuthn to get the credential
      const { startAuthentication } = await import('@simplewebauthn/browser');
      
      const credential = await startAuthentication({
        optionsJSON: optionsResult.options,
      });

      // Verify the authentication
      const verifyResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_passkey_authentication', email, response: credential }),
      });
      const verifyResult = await verifyResponse.json();

      if (verifyResult.success) {
        const userData: User = { 
          id: verifyResult.userId, 
          playerUuid: verifyResult.playerUuid || '',
          email, 
          phone: null 
        };
        setUser(userData);
        localStorage.setItem('chatplay_user', JSON.stringify(userData));
      }

      return verifyResult;
    } catch (error) {
      console.error('[Auth] Passkey login error:', error);
      return { success: false, message: 'Passkey authentication failed' };
    }
  };

  const registerPasskey = async (userId: number) => {
    try {
      const email = user?.email || undefined;
      
      // Get registration options
      const optionsResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register_passkey_options', userId, email }),
      });
      const optionsResult = await optionsResponse.json();
      
      if (!optionsResult.success) {
        return { success: false, message: optionsResult.error || 'Failed to get registration options' };
      }

      // Use SimpleWebAuthn to register the credential
      const { startRegistration } = await import('@simplewebauthn/browser');
      
      const credential = await startRegistration({
        optionsJSON: optionsResult.options,
      });

      // Verify the registration
      const verifyResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_passkey_registration', userId, response: credential }),
      });
      const verifyResult = await verifyResponse.json();

      return verifyResult;
    } catch (error) {
      console.error('[Auth] Passkey registration error:', error);
      return { success: false, message: 'Passkey registration failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('chatplay_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithEmail,
        loginWithSms,
        verifyOtp,
        loginWithPasskey,
        registerPasskey,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}