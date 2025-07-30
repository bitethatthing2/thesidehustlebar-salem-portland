import { useState, useEffect } from 'react';

export function useWolfpackSession(user: any, locationName: string) {
  return {
    sessionId: 'mock-session-id',
    locationId: 'mock-location-id',
    isActive: true
  };
}

export function useWolfpack(sessionId: string, locationId: string, options: any) {
  const [state, setState] = useState({
    members: [],
    messages: [],
    isConnected: true
  });

  const actions = {
    sendMessage: async (message: string) => {
      console.log('Sending message:', message);
      return { success: true };
    },
    addReaction: async (messageId: string, emoji: string) => {
      console.log('Adding reaction:', emoji);
      return { success: true };
    },
    removeReaction: async (reactionId: string) => {
      console.log('Removing reaction:', reactionId);
      return { success: true };
    }
  };

  return { state, actions };
}

export function useTypingIndicators(sessionId: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const sendTyping = (userId: string, userName: string, isTyping: boolean) => {
    console.log('Typing status:', userName, isTyping);
  };

  return { typingUsers, sendTyping };
}