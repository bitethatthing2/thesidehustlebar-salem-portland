'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userProfile: any | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userProfile: null,
  refreshSession: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .single();

      if (error) {
        console.error('[AUTH] Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[AUTH] Unexpected error fetching user profile:', error);
      return null;
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AUTH] Error refreshing session:', error);
        return;
      }

      if (session) {
        setSession(session);
        setUser(session.user);
        
        // Refresh user profile
        const profile = await fetchUserProfile(session.user.id);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('[AUTH] Unexpected error refreshing session:', error);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserProfile(null);
    } catch (error) {
      console.error('[AUTH] Error signing out:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initial session check
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AUTH] Error getting initial session:', error);
        }

        if (mounted && session) {
          setSession(session);
          setUser(session.user);
          
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('[AUTH] Unexpected error during initialization:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            setUserProfile(profile);
          } else {
            setUserProfile(null);
          }
          
          setLoading(false);
        }
      }
    );

    // Periodic session refresh (every 30 minutes)
    const sessionRefreshInterval = setInterval(() => {
      if (mounted) {
        console.log('[AUTH] Periodic session refresh');
        refreshSession();
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Refresh session when window regains focus
    const handleWindowFocus = () => {
      if (mounted) {
        console.log('[AUTH] Window focus - refreshing session');
        refreshSession();
      }
    };

    // Add event listeners
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(sessionRefreshInterval);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleWindowFocus);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userProfile,
        refreshSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};