'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { client, Thread, NpcMessage, ThreadHistory } from '@/lib/socket';
import styles from './page.module.css';

interface Message {
  id: string;
  senderType: 'player' | 'npc';
  senderName: string;
  content: string;
  timestamp: string;
}

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [connected, setConnected] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasFamilyInfo, setHasFamilyInfo] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<Thread | null>(null);

  // Check if user has family info
  useEffect(() => {
    if (user?.email) {
      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_profile', email: user.email }),
      })
        .then(res => res.json())
        .then(result => {
          const hasInfo = !!result.profile?.family_name;
          setHasFamilyInfo(hasInfo);
          
          // If has family info, fetch NPCs for the thread list
          if (hasInfo) {
            fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get_npcs', email: user.email }),
            })
              .then(npcRes => npcRes.json())
              .then(npcResult => {
                if (npcResult.success && npcResult.npcs && npcResult.npcs.length > 0) {
                  console.log('[UI] NPCs from DB:', npcResult.npcs);
                  // Convert NPCs to thread format (database returns npc_id not npcId)
                  const npcThreads: Thread[] = npcResult.npcs.map((npc: {npc_id: string; name: string; role: string}) => ({
                    id: npc.npc_id,
                    npcId: npc.npc_id,
                    npcName: npc.name,
                    unreadCount: 0,
                    isArchive: false,
                    lastMessageAt: new Date().toISOString()
                  }));
                  console.log('[UI] Created threads:', npcThreads.map(t => t.npcId));
                  setThreads(npcThreads);
                } else {
                  // No NPCs in DB yet - generate them now
                  fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'generate_npcs', email: user.email }),
                  })
                    .then(genRes => genRes.json())
                    .then(genResult => {
                      console.log('[UI] generate_npcs result:', genResult);
                      if (genResult.success && genResult.npcs) {
                        const npcThreads: Thread[] = genResult.npcs.map((npc: {npc_id: string; name: string; role: string}) => ({
                          id: npc.npc_id,
                          npcId: npc.npc_id,
                          npcName: npc.name,
                          unreadCount: 0,
                          isArchive: false,
                          lastMessageAt: new Date().toISOString()
                        }));
                        console.log('[UI] Generated threads:', npcThreads);
                        setThreads(npcThreads);
                      }
                    });
                }
              })
              .catch(console.error);
          } else {
            // No family info - clear threads
            setThreads([]);
          }
        })
        .catch(() => setHasFamilyInfo(false));
    }
  }, [user?.email]);

  // Keep ref in sync with state
  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  useEffect(() => {
    // Handle incoming NPC message (single response)
    client.on('npc_message', (data: NpcMessage) => {
      console.log('[Client] Received npc_message:', data);
      const currentThread = activeThreadRef.current;
      if (currentThread && data.npcId === currentThread.npcId) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          senderType: 'npc',
          senderName: currentThread.npcName,
          content: data.content,
          timestamp: data.timestamp
        }]);
      }
      setThreads(prev => prev.map(t => 
        t.npcId === data.npcId 
          ? { ...t, unreadCount: t.unreadCount + 1, lastMessageAt: data.timestamp }
          : t
      ));
    });

    // Handle thread history (full conversation when switching threads)
    client.on('thread_history', (data: ThreadHistory) => {
      console.log('[Client] Received thread_history:', data);
      // Only use socket history if we haven't loaded from DB yet
      const currentThread = activeThreadRef.current;
      if (currentThread && data.npcId === currentThread.npcId && messages.length === 0) {
        const historyMessages: Message[] = data.messages.map(m => ({
          id: m.id,
          senderType: m.sender as 'player' | 'npc',
          senderName: m.sender === 'player' ? 'You' : currentThread.npcName,
          content: m.content,
          timestamp: m.timestamp
        }));
        console.log('[Client] Setting messages from socket:', historyMessages.length);
        setMessages(historyMessages);
      }
    });

    client.on('thread_update', (data: Thread[]) => {
      console.log('[Client] Received thread_update:', data.length, 'threads');
      // Only update threads from socket if we don't have NPCs from database yet
      if (threads.length === 0 && hasFamilyInfo) {
        setThreads(data);
      }
    });

    client.on('game_state', () => {});

    client.on('error', (data: { message: string }) => {
      console.error('Server error:', data.message);
    });

    // Cleanup: disconnect socket when component unmounts
    return () => {
      client.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    try {
      await client.connect();
      setConnected(true);
      client.joinGame(user?.id.toString() || 'anonymous');
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !activeThread || !user?.email) return;
    
    setSending(true);
    
    const playerMessage = {
      id: crypto.randomUUID(),
      senderType: 'player' as const,
      senderName: 'You',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, playerMessage]);
    
    try {
      // Save message to database using playerUuid
      console.log(`[UI] Saving message: npcUuid=${activeThread.npcId}, playerUuid=${user.playerUuid}, content="${input.substring(0, 20)}..."`);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save_message', 
          playerUuid: user.playerUuid,
          npcUuid: activeThread.npcId,
          sender: 'player',
          content: input
        }),
      });
      const result = await res.json();
      console.log(`[UI] save_message result:`, result);
      
      // Also send to socket for AI response
      client.sendMessage(input);
    } catch (error) {
      console.error('[UI] Failed to send message:', error);
    }
    
    setInput('');
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-connect on login (only when family info exists)
  useEffect(() => {
    if (isAuthenticated && !connected && hasFamilyInfo === true) {
      handleConnect();
    }
  }, [isAuthenticated, hasFamilyInfo]);

  // Redirect to login if not authenticated
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.login}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.login}>
          <h1>ChatPlay Mafia</h1>
          <p>Please sign in to continue.</p>
          <a href="/login">
            <button className={styles.connectButton}>
              Sign In
            </button>
          </a>
        </div>
      </div>
    );
  }

  // Show loading while socket connects (only when family info exists)
  if (!connected && hasFamilyInfo === true) {
    return (
      <div className={styles.container}>
        <div className={styles.login}>
          <h1>ChatPlay Mafia</h1>
          <p>Connecting...</p>
        </div>
        {user && (
          <div className={styles.userMenu}>
            <button 
              className={styles.userMenuButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <span className={styles.userIcon}>👤</span>
              <span className={styles.userEmail}>{user?.email}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // No family info state - show the game setup UI but don't connect socket
  if (!hasFamilyInfo) {
    return (
      <div className={styles.container}>
        <div className={styles.login}>
          <h1>ChatPlay Mafia</h1>
          <p>Set up your Family Profile to begin.</p>
          <a href="/familyinfo">
            <button className={styles.connectButton}>
              Start New Game
            </button>
          </a>
        </div>
        {user && (
          <div className={styles.userMenu}>
            <button 
              className={styles.userMenuButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <span className={styles.userIcon}>👤</span>
              <span className={styles.userEmail}>{user?.email}</span>
              <span className={styles.menuArrow}>{showUserMenu ? '▲' : '▼'}</span>
            </button>
            {showUserMenu && (
              <div className={styles.dropdownMenu}>
                <a href="/userprofile" className={styles.menuItem}>My Account</a>
                <button 
                  className={styles.menuItem} 
                  onClick={() => {
                    logout();
                    window.location.href = '/login';
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Messages</h2>
        </div>
        <button 
          className={styles.familyInfoButton}
          onClick={() => window.location.href = '/familyinfo'}
        >
          👥 Family Info
        </button>
        {hasFamilyInfo && (
          <div className={styles.threadList}>
            {threads.filter(t => !t.isArchive).map(thread => (
              <div
                key={thread.id}
                className={`${styles.threadItem} ${activeThread?.id === thread.id ? styles.active : ''}`}
                onClick={async () => {
                  console.log(`[UI] Thread click: npcUuid=${thread.npcId}, name=${thread.npcName}`);
                  setActiveThread(thread);
                  setMessages([]);
                  // Load messages for this NPC using UUID
                  if (user?.playerUuid && thread.npcId) {
                    console.log(`[UI] Loading messages for npcUuid="${thread.npcId}", playerUuid=${user.playerUuid}`);
                    try {
                      const res = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          action: 'get_thread_messages', 
                          playerUuid: user.playerUuid,
                          npcUuid: thread.npcId 
                        }),
                      });
                      const result = await res.json();
                      console.log(`[UI] get_thread_messages result:`, result);
                      if (result.success && result.messages) {
                        setMessages(result.messages.map((m: {id: string; sender: string; content: string; timestamp: string}) => ({
                          id: m.id,
                          senderType: m.sender as 'player' | 'npc',
                          senderName: m.sender === 'player' ? 'You' : thread.npcName,
                          content: m.content,
                          timestamp: m.timestamp
                        })));
                      }
                    } catch (e) {
                      console.error('[UI] Failed to load messages:', e);
                    }
                  }
                }}
              >
                <div className={styles.threadName}>{thread.npcName}</div>
                <div className={styles.threadPreview}>
                  {thread.unreadCount > 0 && (
                    <span className={styles.unread}>{thread.unreadCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!hasFamilyInfo && hasFamilyInfo !== null && (
          <p style={{ padding: '1rem', color: '#555', fontStyle: 'italic', fontSize: '0.875rem' }}>
            Set up your Family Profile to begin
          </p>
        )}
        {threads.some(t => t.isArchive) && (
          <>
            <div className={styles.sidebarHeader}>
              <h2>Archive</h2>
            </div>
            <div className={styles.threadList}>
              {threads.filter(t => t.isArchive).map(thread => (
                <div
                  key={thread.id}
                  className={`${styles.threadItem} ${styles.archive} ${activeThread?.id === thread.id ? styles.active : ''}`}
                  onClick={() => setActiveThread(thread)}
                >
                  <div className={styles.threadName}>{thread.npcName}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className={styles.chat}>
        {hasFamilyInfo && activeThread ? (
          <>
            <div className={styles.chatHeader}>
              <h3>{activeThread.npcName}</h3>
            </div>
            <div className={styles.messageList}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${msg.senderType === 'player' ? styles.playerMessage : styles.npcMessage}`}
                >
                  <div className={styles.messageContent}>{msg.content}</div>
                  <div className={styles.messageTime}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.inputArea}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Write your message..."
                className={styles.input}
                rows={2}
              />
              <button 
                onClick={handleSend} 
                disabled={!input.trim() || sending}
                className={styles.sendButton}
              >
                Send
              </button>
            </div>
          </>
        ) : hasFamilyInfo && (
          <div className={styles.noThread}>
            <p>Select a conversation to begin.</p>
          </div>
        )}
      </div>

      {user && (
        <div className={styles.userMenu}>
          <button 
            className={styles.userMenuButton}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <span className={styles.userIcon}>👤</span>
            <span className={styles.userEmail}>{user?.email}</span>
            <span className={styles.menuArrow}>{showUserMenu ? '▲' : '▼'}</span>
          </button>
          {showUserMenu && (
            <div className={styles.dropdownMenu}>
              <a href="/userprofile" className={styles.menuItem}>My Account</a>
              <button 
                className={styles.menuItem} 
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}