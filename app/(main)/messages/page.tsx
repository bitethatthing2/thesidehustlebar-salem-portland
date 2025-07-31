'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { wolfpackService } from '@/lib/services/unified-wolfpack.service';
import { ArrowLeft, Search, MessageCircle, User } from 'lucide-react';
import Image from 'next/image';

interface Conversation {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_online: boolean;
}

export default function MessagesInboxPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    loadConversations();
  }, [currentUser, router]);

  // Search for users when search query changes
  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      searchForUsers();
    } else {
      setSearchUsers([]);
    }
  }, [searchQuery]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/messages/conversations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchForUsers = async () => {
    if (!currentUser || !searchQuery.trim()) return;

    try {
      setSearchingUsers(true);
      const response = await wolfpackService.searchUsers(searchQuery, currentUser.id, 10);
      
      if (response.success) {
        setSearchUsers(response.data || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchingUsers(false);
    }
  };

  const getDisplayName = (conversation: Conversation) => {
    return conversation.display_name || 
           conversation.username || 
           'Anonymous';
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const filteredConversations = conversations.filter(conv =>
    getDisplayName(conv).toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-800 bg-black sticky top-0 z-10">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Messages</h1>
        </div>
        
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <Search className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-gray-800 border border-gray-700 rounded-full py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* User Search Results or Conversations List */}
      <div className="flex-1">
        {searchQuery.trim().length > 2 ? (
          // Show search results
          <div>
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-400">Search Results</h3>
            </div>
            
            {searchingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
              </div>
            ) : searchUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No users found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {searchUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => router.push(`/messages/${user.id}`)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-900/50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                      <Image
                        src={user.avatar_url || '/icons/wolf-icon.png'}
                        alt={wolfpackService.getDisplayName(user)}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {wolfpackService.getDisplayName(user)}
                      </h3>
                      {user.username && (
                        <p className="text-sm text-gray-400">@{user.username}</p>
                      )}
                    </div>
                    
                    <div className="text-xs bg-red-600 text-white px-3 py-1 rounded-full">
                      Message
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Show existing conversations or empty state
          filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No conversations yet</h3>
              <p className="text-gray-400 text-center mb-6">
                Search for users above to start messaging them
              </p>
              <button
                onClick={() => router.push('/wolfpack/feed')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
              >
                Explore Feed
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.user_id}
                  onClick={() => router.push(`/messages/${conversation.user_id}`)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-900/50 transition-colors text-left"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                      <Image
                        src={conversation.avatar_url || '/icons/wolf-icon.png'}
                        alt={getDisplayName(conversation)}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {conversation.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white truncate">
                        {getDisplayName(conversation)}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {formatTime(conversation.last_message_time)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400 truncate">
                        {conversation.last_message || 'Start a conversation...'}
                      </p>
                      {conversation.unread_count > 0 && (
                        <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2 flex-shrink-0">
                          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}