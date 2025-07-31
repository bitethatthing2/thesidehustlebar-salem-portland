'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { wolfpackService } from '@/lib/services/unified-wolfpack.service';
import { ArrowLeft, Send } from 'lucide-react';
import Image from 'next/image';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface UserProfile {
  id: string;
  display_name: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
}

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const recipientUserId = params.userId as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser || !recipientUserId) return;

    loadRecipientProfile();
    loadMessages();
  }, [currentUser, recipientUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadRecipientProfile = async () => {
    const profile = await wolfpackService.getUserProfile(recipientUserId);
    if (profile) {
      setRecipient(profile);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/messages/conversation/${recipientUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;

    try {
      setSending(true);
      
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: recipientUserId,
          content: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const sentMessage = await response.json();
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
        
        // Send push notification
        await wolfpackService.notifyNewMessage(currentUser.id, recipientUserId, newMessage.trim());
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getDisplayName = (user: UserProfile | null) => {
    if (!user) return 'Unknown User';
    return user.display_name || 
           `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
           user.username || 
           'Anonymous';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header - Exact match to screenshot */}
      <div className="flex items-center gap-3 p-4 bg-black">
        <button 
          onClick={() => router.push('/wolfpack/feed')}
          className="text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Image
            src={recipient?.avatar_url || '/icons/wolf-icon.png'}
            alt={getDisplayName(recipient)}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
        
        <h1 className="text-white font-medium">
          {getDisplayName(recipient)}
        </h1>
      </div>

      {/* Messages List - Center content like screenshot */}
      <div className="flex-1 flex items-center justify-center">
        {messages.length === 0 ? (
          <div className="text-center">
            <p className="text-white text-lg mb-2">No messages yet</p>
            <p className="text-gray-400 text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isFromCurrentUser = message.sender_id === currentUser?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      isFromCurrentUser
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      isFromCurrentUser ? 'text-red-200' : 'text-gray-400'
                    }`}>
                      {new Date(message.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Section - Exact match to screenshot */}
      <div className="bg-black p-4 space-y-4">
        {/* Emoji Bar - Exactly like screenshot */}
        <div className="flex justify-center gap-4">
          {['❤️', '😂', '😍', '👏', '🔥', '💯', '🎉', '😢'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => setNewMessage(prev => prev + emoji)}
              className="text-2xl hover:scale-110 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
        
        {/* Message Input - Exactly like screenshot */}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 rounded-full px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={sending}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}