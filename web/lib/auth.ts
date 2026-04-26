// @ts-nocheck
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import {
  getOrCreateUserByEmail,
  getOrCreateUserByPhone,
  getUserById,
  getPasskeyCredentials,
  storePasskeyCredential,
  updatePasskeyCounter,
  storeOtpCode,
  verifyOtpCode,
} from './db';
import { sendOtpEmail as sendEmailOtp, sendSms as sendSmsOtp } from './email';

const RP_NAME = 'ChatPlay Mafia';
const RP_ID = 'chatplay-mafia-production.up.railway.app';
const ORIGIN = 'https://chatplay-mafia-production.up.railway.app';
async function sendEmailOtpCode(email: string, code: string): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Auth] SMTP not configured, OTP for ${email}: ${code}`);
    return false;
  }
  return await sendEmailOtp(email, code);
}

// Internal function to actually send the SMS
async function sendSmsOtpCode(phone: string, code: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[Auth] Twilio not configured, OTP for ${phone}: ${code}`);
    return false;
  }
  return await sendSmsOtp(phone, code);
}

export async function sendOtpEmail(email: string): Promise<SendOtpResult> {
  try {
    const user = await getOrCreateUserByEmail(email);
    const code = generateOtp();
    await storeOtpCode(user.id, code, 'email');
    
    const sent = await sendEmailOtpCode(email, code);
    
    return {
      success: true,
      message: sent ? `Verification code sent to ${email}` : `Code: ${code}`,
      userId: user.id,
    };
  } catch (error) {
    console.error('[Auth] Send OTP error:', error);
    return {
      success: false,
      message: 'Failed to send verification code',
    };
  }
}

export async function sendOtpSms(phone: string): Promise<SendOtpResult> {
  try {
    const user = await getOrCreateUserByPhone(phone);
    const code = generateOtp();
    await storeOtpCode(user.id, code, 'sms');
    
    const sent = await sendSmsOtpCode(phone, code);
    
    return {
      success: true,
      message: sent ? `Verification code sent to ${phone}` : `Code: ${code}`,
      userId: user.id,
    };
  } catch (error) {
    console.error('[Auth] Send OTP error:', error);
    return {
      success: false,
      message: 'Failed to send verification code',
    };
  }
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  userId?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  userId?: number;
}

export async function verifyOtp(userId: number, code: string): Promise<VerifyOtpResult> {
  try {
    const isValid = await verifyOtpCode(userId, code);
    
    if (isValid) {
      return {
        success: true,
        message: 'Verification successful',
        userId,
      };
    }
    
    return {
      success: false,
      message: 'Invalid or expired verification code',
    };
  } catch (error) {
    console.error('[Auth] Verify OTP error:', error);
    return {
      success: false,
      message: 'Verification failed',
    };
  }
}

export interface GenerateRegistrationOptionsResult {
  success: boolean;
  options?: any;
  error?: string;
}

export async function generatePasskeyRegistrationOptions(userId: number, email: string): Promise<GenerateRegistrationOptionsResult> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const existingCredentials = await getPasskeyCredentials(userId);
    const excludeCredentials: any[] = existingCredentials.map((cred) => ({
      id: cred.credential_id,
      type: 'public-key',
    }));

    const options = generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: isoUint8Array.fromUTF8String(userId.toString()),
      userName: email || user.email || `user_${userId}`,
      userDisplayName: email || user.email || `User ${userId}`,
      excludeCredentials,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
    });

    console.log('[Auth] Generated registration options for user:', userId);

    return { success: true, options };
  } catch (error) {
    console.error('[Auth] Registration options error:', error);
    return { success: false, error: 'Failed to generate registration options' };
  }
}

export interface VerifyRegistrationResult {
  success: boolean;
  message: string;
  credentialId?: string;
}

export async function verifyPasskeyRegistration(
  userId: number,
  response: any
): Promise<VerifyRegistrationResult> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: 'stored-challenge',
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (verified && registrationInfo) {
      const credential = registrationInfo.credential as any;
      const counter = (registrationInfo as any).counter || 0;
      const credId = credential.credentialID as Uint8Array;
      const pubKey = credential.publicKey as Uint8Array;
      
      await storePasskeyCredential(
        userId,
        isoBase64URL.fromBuffer(credId.buffer.slice(credId.byteOffset, credId.byteOffset + credId.byteLength)),
        isoBase64URL.fromBuffer(pubKey.buffer.slice(pubKey.byteOffset, pubKey.byteOffset + pubKey.byteLength)),
        counter,
        'cross-platform'
      );

      return {
        success: true,
        message: 'Passkey registered successfully',
        credentialId: isoBase64URL.fromBuffer(credId.buffer.slice(credId.byteOffset, credId.byteOffset + credId.byteLength)),
      };
    }

    return { success: false, message: 'Passkey verification failed' };
  } catch (error) {
    console.error('[Auth] Registration verification error:', error);
    return { success: false, message: 'Passkey registration failed' };
  }
}

export interface GenerateAuthenticationOptionsResult {
  success: boolean;
  options?: any;
  error?: string;
}

export async function generatePasskeyAuthenticationOptions(email: string): Promise<GenerateAuthenticationOptionsResult> {
  try {
    const user = await getOrCreateUserByEmail(email);
    const credentials = await getPasskeyCredentials(user.id);

    if (credentials.length === 0) {
      return { success: false, error: 'No passkeys registered for this user' };
    }

    const options = generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      timeout: 60000,
      allowCredentials: credentials.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key',
      })),
    });

    console.log('[Auth] Generated authentication options for user:', user.id);

    return { success: true, options };
  } catch (error) {
    console.error('[Auth] Authentication options error:', error);
    return { success: false, error: 'Failed to generate authentication options' };
  }
}

export interface VerifyAuthenticationResult {
  success: boolean;
  message: string;
  userId?: number;
}

export async function verifyPasskeyAuthentication(
  email: string,
  response: any
): Promise<VerifyAuthenticationResult> {
  try {
    const user = await getOrCreateUserByEmail(email);
    const credentials = await getPasskeyCredentials(user.id);

    if (credentials.length === 0) {
      return { success: false, message: 'No passkeys registered' };
    }

    const credentialToVerify = credentials.find((c) => c.credential_id === response.credentialId);
    if (!credentialToVerify) {
      return { success: false, message: 'Credential not found' };
    }

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: 'stored-challenge',
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: credentialToVerify.credential_id,
        publicKey: Buffer.from(credentialToVerify.public_key, 'base64'),
        counter: credentialToVerify.counter,
      },
    } as any);

    if (verified) {
      await updatePasskeyCounter(credentialToVerify.credential_id, authenticationInfo.newCounter);

      return {
        success: true,
        message: 'Authentication successful',
        userId: user.id,
      };
    }

    return { success: false, message: 'Authentication verification failed' };
  } catch (error) {
    console.error('[Auth] Authentication verification error:', error);
    return { success: false, message: 'Authentication failed' };
  }
}