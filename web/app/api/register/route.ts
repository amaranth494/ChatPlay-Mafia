import { NextRequest, NextResponse } from 'next/server';
import { isUserRegistered, getUserProfile, completeRegistration, addUserPhone } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email required' }, { status: 400 });
    }

    switch (action) {
      case 'check_registration': {
        const isRegistered = await isUserRegistered(email);
        return NextResponse.json({ 
          success: true, 
          isRegistered,
          profile: isRegistered ? await getUserProfile(email) : null 
        });
      }

      case 'complete_registration': {
        const { familyName, title, gender, sexualPreference } = body;
        if (!familyName || !title || !gender || !sexualPreference) {
          return NextResponse.json({ success: false, message: 'All fields required' }, { status: 400 });
        }
        
        await completeRegistration(email, familyName, title, gender, sexualPreference);
        return NextResponse.json({ success: true, message: 'Registration complete' });
      }

      case 'add_phone': {
        const { phone } = body;
        if (!phone) {
          return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 });
        }
        
        await addUserPhone(email, phone);
        return NextResponse.json({ success: true, message: 'Phone added' });
      }

      default:
        return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Registration API] Error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}