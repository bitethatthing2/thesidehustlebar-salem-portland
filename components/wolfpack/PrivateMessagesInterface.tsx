'use client';

import { useState, useEffect } from 'react';
import { useConversations } from '@/hooks/useChat';
import { useUser } from '@/hooks/useUser';
import { ArrowLeft, MessageCircle, User } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface PrivateMessagesInterfaceProps {
  onNavigateToPrivateChat: (userId: string, userName: string) => void;
  onBack: () => void;
}

export default function PrivateMessagesInterface({
  onNavigateToPrivateChat,
  onBack
}: PrivateMessagesInterfaceProps) {
  const { user } = useUser();
  const { conversations, isLoading, refresh } = useConversations();

  useEffect(() => {
    if (user?.id) {
      refresh();
    }
  }, [user?.id, refresh]);

  const handleConversationClick = (conversation: any) => {
    onNavigateToPrivateChat(conversation.other_user_id, conversation.other_user_display_name);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-900">
        {/* Header */}
        <div className="flex-none h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-400" />
              <span className="text-lg font-semibold text-white">Messages</span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-400">Loading conversations...</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-none h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-400" />
            <span className="text-lg font-semibold text-white">Private Messages</span>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-400 font-medium">No private conversations yet</p>
              <p className="text-gray-500 text-sm mt-1">Go to Members section to start a private chat!</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {conversations.map((conversation) => (
              <div
                key={conversation.other_user_id}
                onClick={() => handleConversationClick(conversation)}
                className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {conversation.other_user_profile_image_url ? (
                    <Image
                      src={conversation.other_user_profile_image_url}
                      alt={conversation.other_user_display_name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover"
                      unoptimized={conversation.other_user_profile_image_url.includes('dicebear.com')}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Unread Badge */}
                  {conversation.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                      </span>
                    </div>
                  )}
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-white truncate">
                      {conversation.other_user_display_name}
                      {conversation.other_user_wolf_emoji && (
                        <span className="ml-2 text-sm">{conversation.other_user_wolf_emoji}</span>
                      )}
                    </h3>
                    {conversation.last_message_time && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(conversation.last_message_time), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${
                      conversation.unread_count > 0 ? 'text-white font-medium' : 'text-gray-400'
                    }`}>
                      {conversation.last_message || 'No messages yet'}
                    </p>
                    
                    {conversation.unread_count > 0 && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}