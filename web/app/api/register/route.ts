import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, getUserProfile, completeRegistration, addUserPhone, isUserRegistered, updateUserProfile, deleteUser } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email } = body;

    if (!email && action !== 'create_user') {
      return NextResponse.json({ success: false, message: 'Email required' }, { status: 400 });
    }

    switch (action) {
      case 'create_user': {
        const { email, phone, firstName, lastName } = body;
        if (!email || !firstName || !lastName) {
          return NextResponse.json({ success: false, message: 'Email, first name, and last name are required' }, { status: 400 });
        }
        
        const existing = await getUserByEmail(email);
        if (existing) {
          return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 400 });
        }
        
        const userId = await createUser(email, phone, firstName, lastName);
        return NextResponse.json({ success: true, userId, message: 'User created' });
      }

      case 'get_profile': {
        const profile = await getUserProfile(email);
        return NextResponse.json({ success: true, profile });
      }

      case 'update_profile': {
        const { phone, firstName, lastName, familyName, title, gender, sexualPreference } = body;
        
        await updateUserProfile(email, { phone, firstName, lastName, familyName, title, gender, sexualPreference });
        return NextResponse.json({ success: true, message: 'Profile updated' });
      }

      case 'delete_account': {
        await deleteUser(email);
        return NextResponse.json({ success: true, message: 'Account deleted' });
      }

      case 'check_registration': {
        const isRegistered = await isUserRegistered(email);
        return NextResponse.json({ 
          success: true, 
          isRegistered,
          profile: isRegistered ? await getUserProfile(email) : null 
        });
      }

      default:
        return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Registration API] Error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

    switch (action) {
      case 'create_user': {
        const { email, phone, firstName, lastName } = body;
        if (!email || !firstName || !lastName) {
          return NextResponse.json({ success: false, message: 'Email, first name, and last name are required' }, { status: 400 });
        }
        
        // Check if email already exists
        const existing = await getUserByEmail(email);
        if (existing) {
          return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 400 });
        }
        
        // Create user - OTP will be sent separately via /api/auth
        const userId = await createUser(email, phone, firstName, lastName);
        return NextResponse.json({ success: true, userId, message: 'User created' });
      }

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