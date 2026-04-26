import { NextRequest, NextResponse } from 'next/server';
import {
  sendOtpEmail,
  sendOtpSms,
  verifyOtp,
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'send_otp_email': {
        const { email } = data;
        if (!email) {
          return NextResponse.json({ success: false, message: 'Email required' }, { status: 400 });
        }
        const result = await sendOtpEmail(email);
        return NextResponse.json(result);
      }

      case 'send_otp_sms': {
        const { phone } = data;
        if (!phone) {
          return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 });
        }
        const result = await sendOtpSms(phone);
        return NextResponse.json(result);
      }

      case 'verify_otp': {
        const { userId, code } = data;
        if (!userId || !code) {
          return NextResponse.json({ success: false, message: 'User ID and code required' }, { status: 400 });
        }
        const result = await verifyOtp(userId, code);
        return NextResponse.json(result);
      }

      case 'register_passkey_options': {
        const { userId, email } = data;
        if (!userId) {
          return NextResponse.json({ success: false, message: 'User ID required' }, { status: 400 });
        }
        const result = await generatePasskeyRegistrationOptions(userId, email);
        return NextResponse.json(result);
      }

      case 'verify_passkey_registration': {
        const { userId, response } = data;
        if (!userId || !response) {
          return NextResponse.json({ success: false, message: 'User ID and response required' }, { status: 400 });
        }
        const result = await verifyPasskeyRegistration(userId, response);
        return NextResponse.json(result);
      }

      case 'authenticate_passkey_options': {
        const { email } = data;
        if (!email) {
          return NextResponse.json({ success: false, message: 'Email required' }, { status: 400 });
        }
        const result = await generatePasskeyAuthenticationOptions(email);
        return NextResponse.json(result);
      }

      case 'verify_passkey_authentication': {
        const { email, response } = data;
        if (!email || !response) {
          return NextResponse.json({ success: false, message: 'Email and response required' }, { status: 400 });
        }
        const result = await verifyPasskeyAuthentication(email, response);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Auth API] Error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}