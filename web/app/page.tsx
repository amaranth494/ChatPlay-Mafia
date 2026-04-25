'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [connected, setConnected] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle incoming NPC message (single response)
    client.on('npc_message', (data: NpcMessage) => {
      console.log('[Client] Received npc_message:', data);
      if (activeThread && data.npcId === activeThread.npcId) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          senderType: 'npc',
          senderName: activeThread.npcName,
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
      if (activeThread && data.npcId === activeThread.npcId) {
        const historyMessages: Message[] = data.messages.map(m => ({
          id: m.id,
          senderType: m.sender as 'player' | 'npc',
          senderName: m.sender === 'player' ? 'You' : activeThread.npcName,
          content: m.content,
          timestamp: m.timestamp
        }));
        console.log('[Client] Setting messages:', historyMessages.length);
        setMessages(historyMessages);
      }
    });

    client.on('thread_update', (data: Thread[]) => {
      console.log('[Client] Received thread_update:', data.length, 'threads');
      setThreads(data);
    });

    client.on('game_state', () => {});

    client.on('error', (data: { message: string }) => {
      console.error('Server error:', data.message);
    });

    return () => {
      client.disconnect();
    };
  }, [activeThread]);

  const handleConnect = async () => {
    try {
      await client.connect();
      setConnected(true);
      client.joinGame();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !activeThread) return;
    
    setSending(true);
    client.sendMessage(input);
    
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      senderType: 'player',
      senderName: 'You',
      content: input,
      timestamp: new Date().toISOString()
    }]);
    
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

  if (!connected) {
    return (
      <div className={styles.container}>
        <div className={styles.login}>
          <h1>ChatPlay Mafia</h1>
          <p>Connect to begin your reign.</p>
          <button onClick={handleConnect} className={styles.connectButton}>
            Enter the Family
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Messages</h2>
        </div>
        <div className={styles.threadList}>
          {threads.filter(t => !t.isArchive).map(thread => (
            <div
              key={thread.id}
              className={`${styles.threadItem} ${activeThread?.id === thread.id ? styles.active : ''}`}
              onClick={() => {
                setActiveThread(thread);
                client.selectNpc(thread.npcId);
                // Delay markRead to avoid socket issues
                setTimeout(() => {
                  client.markRead(thread.id);
                }, 100);
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
        {activeThread ? (
          <>
            <div className={styles.chatHeader}>
              <h3>{activeThread.npcName}</h3>
            </div>
            <div className={styles.messageList}>
              {messages.filter(msg => 
                msg.senderType === 'player' || (activeThread && msg.senderName === activeThread.npcName)
              ).map(msg => (
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
        ) : (
          <div className={styles.noThread}>
            <p>Select a conversation to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}