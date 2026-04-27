import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, getUserProfile, completeRegistration, addUserPhone, isUserRegistered, updateUserProfile, deleteUser, checkUserHasNpcs, generateNpcsForUser, getUserNpcs, clearFamilyInfo, getOrCreateThread, getMessageHistory, saveMessage } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, playerUuid } = body;

    // Some actions require playerUuid instead of email
    const needsUuid = action === 'get_thread_messages' || action === 'save_message';
    if (needsUuid && !playerUuid) {
      return NextResponse.json({ success: false, message: 'Player UUID required' }, { status: 400 });
    }
    
    // Other actions need email (except create_user)
    if (!email && action !== 'create_user' && !needsUuid) {
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

      case 'generate_npcs': {
        const user = await getUserByEmail(email);
        if (!user) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 400 });
        }
        
        const hasNpcs = await checkUserHasNpcs(user.id);
        if (!hasNpcs) {
          await generateNpcsForUser(user.id);
        }
        
        const npcs = await getUserNpcs(user.id);
        return NextResponse.json({ success: true, npcs });
      }

      case 'get_npcs': {
        const user = await getUserByEmail(email);
        if (!user) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 400 });
        }
        
        const npcs = await getUserNpcs(user.id);
        return NextResponse.json({ success: true, npcs });
      }

      case 'clear_family_info': {
        const user = await getUserByEmail(email);
        if (!user) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 400 });
        }
        
        await clearFamilyInfo(user.id);
        return NextResponse.json({ success: true, message: 'Family info cleared' });
      }

      case 'get_thread_messages': {
        const { playerUuid, npcUuid } = body;
        if (!playerUuid) {
          return NextResponse.json({ success: false, message: 'Player UUID required' }, { status: 400 });
        }
        if (!npcUuid) {
          return NextResponse.json({ success: false, message: 'NPC UUID required' }, { status: 400 });
        }
        
        console.log(`[API] get_thread_messages: playerUuid=${playerUuid}, npcUuid="${npcUuid}"`);
        
        const threadUuid = await getOrCreateThread(npcUuid, playerUuid);
        console.log(`[API] threadUuid=${threadUuid}`);
        
        const messages = await getMessageHistory(threadUuid);
        console.log(`[API] loaded ${messages.length} messages`);
        
        return NextResponse.json({ success: true, messages, threadUuid });
      }

      case 'save_message': {
        const { playerUuid, npcUuid, sender, content } = body;
        if (!playerUuid) {
          return NextResponse.json({ success: false, message: 'Player UUID required' }, { status: 400 });
        }
        if (!npcUuid || !sender || !content) {
          return NextResponse.json({ success: false, message: 'NPC UUID, sender, and content required' }, { status: 400 });
        }
        
        console.log(`[API] save_message: playerUuid=${playerUuid}, npcUuid=${npcUuid}, sender=${sender}, content=${content.substring(0, 30)}`);
        
        const threadUuid = await getOrCreateThread(npcUuid, playerUuid);
        console.log(`[API] threadUuid=${threadUuid}`);
        
        await saveMessage(threadUuid, sender, content);
        
        return NextResponse.json({ success: true, threadUuid });
      }

      default:
        return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Registration API] Error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
