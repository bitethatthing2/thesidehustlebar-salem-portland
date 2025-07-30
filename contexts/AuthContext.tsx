// contexts/AuthContext.tsx

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Complete user profile type matching the database schema
interface DatabaseUser {
  id: string;
  email: string;
  auth_id: string | null;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  profile_image_url: string | null;
  wolf_emoji: string | null;
  bio: string | null;
  verified: boolean | null;
  is_vip: boolean | null;
  wolfpack_status: string | null;
  wolfpack_tier: string | null;
  wolfpack_joined_at: string | null;
  business_account: boolean | null;
  artist_account: boolean | null;
  location: string | null;
  city: string | null;
  state: string | null;
  location_verified: boolean | null;
  privacy_settings: any | null;
  notification_preferences: any | null;
  is_online: boolean | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  is_wolfpack_member: boolean | null;
  status: string | null;
  loyalty_score: number | null;
  pack_badges: any | null;
  pack_achievements: any | null;
}

// Transformed user type for the app
export interface CurrentUser {
  id: string;
  email: string;
  authId: string;
  role: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  profileImageUrl?: string;
  wolfEmoji: string;
  bio?: string;
  verified: boolean;
  isVip: boolean;
  wolfpackStatus: 'active' | 'pending' | 'inactive';
  wolfpackTier: 'basic' | 'premium' | 'vip';
  wolfpackJoinedAt?: string;
  businessAccount: boolean;
  artistAccount: boolean;
  location?: string;
  city?: string;
  state?: string;
  locationVerified: boolean;
  privacySettings: {
    acceptWinks: boolean;
    showLocation: boolean;
    acceptMessages: boolean;
    profileVisible: boolean;
  };
  notificationPreferences: {
    events: boolean;
    marketing: boolean;
    announcements: boolean;
    chatMessages: boolean;
    orderUpdates: boolean;
    memberActivity: boolean;
    socialInteractions: boolean;
  };
  isOnline: boolean;
  lastSeenAt?: string;
  status: 'active' | 'inactive' | 'blocked';
  loyaltyScore: number;
  packBadges: any;
  packAchievements: any;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  currentUser: CurrentUser | null;
  error: Error | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (updates: Partial<DatabaseUser>) => Promise<void>;
  // Helper methods
  isAuthenticated: boolean;
  hasProfile: boolean;
  isReady: boolean;
  requireAuth: () => { user: User; session: Session };
  requireProfile: () => CurrentUser;
}

// Transform database user to app user
const transformDatabaseUser = (dbUser: DatabaseUser, authUser: User): CurrentUser => {
  return {
    id: dbUser.id,
    email: dbUser.email,
    authId: dbUser.auth_id || authUser.id,
    role: dbUser.role || 'user',
    firstName: dbUser.first_name || undefined,
    lastName: dbUser.last_name || undefined,
    displayName: dbUser.display_name || undefined,
    username: dbUser.username || undefined,
    avatarUrl: dbUser.avatar_url || undefined,
    profileImageUrl: dbUser.profile_image_url || dbUser.avatar_url || undefined,
    wolfEmoji: dbUser.wolf_emoji || '🐺',
    bio: dbUser.bio || undefined,
    verified: dbUser.verified || false,
    isVip: dbUser.is_vip || false,
    wolfpackStatus: (dbUser.wolfpack_status as any) || 'pending',
    wolfpackTier: (dbUser.wolfpack_tier as any) || 'basic',
    wolfpackJoinedAt: dbUser.wolfpack_joined_at || undefined,
    businessAccount: dbUser.business_account || false,
    artistAccount: dbUser.artist_account || false,
    location: dbUser.location || undefined,
    city: dbUser.city || undefined,
    state: dbUser.state || undefined,
    locationVerified: dbUser.location_verified || false,
    privacySettings: dbUser.privacy_settings || {
      acceptWinks: true,
      showLocation: true,
      acceptMessages: true,
      profileVisible: true
    },
    notificationPreferences: dbUser.notification_preferences || {
      events: true,
      marketing: false,
      announcements: true,
      chatMessages: true,
      orderUpdates: true,
      memberActivity: true,
      socialInteractions: true
    },
    isOnline: dbUser.is_online || false,
    lastSeenAt: dbUser.last_seen_at || undefined,
    status: (dbUser.status as any) || 'active',
    loyaltyScore: dbUser.loyalty_score || 0,
    packBadges: dbUser.pack_badges || {},
    packAchievements: dbUser.pack_achievements || {},
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at
  };
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  currentUser: null,
  error: null,
  signOut: async () => {},
  refresh: async () => {},
  updateProfile: async () => {},
  isAuthenticated: false,
  hasProfile: false,
  isReady: false,
  requireAuth: () => { throw new Error('Not authenticated'); },
  requireProfile: () => { throw new Error('No profile'); },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Ensure user profile exists in database
  const ensureUserProfile = useCallback(async (authUser: User) => {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            auth_id: authUser.id,
            email: authUser.email!,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('[AUTH] Error creating user profile:', insertError);
          throw insertError;
        }
      }
    } catch (err) {
      console.error('[AUTH] Error ensuring user profile:', err);
      throw err;
    }
  }, []);

  // Fetch complete user profile
  const fetchUserProfile = useCallback(async (authUser: User): Promise<CurrentUser | null> => {
    if (!authUser?.id) return null;

    try {
      await ensureUserProfile(authUser);

      // Try to get from view first, fall back to direct table query
      const { data: profile, error: profileError } = await supabase
        .from('current_user_profile')
        .select('*')
        .single();

      if (profileError) {
        const { data: directProfile, error: directError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', authUser.id)
          .single();

        if (directError) throw directError;
        
        return transformDatabaseUser(directProfile as DatabaseUser, authUser);
      } else {
        return transformDatabaseUser(profile as DatabaseUser, authUser);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Auth session missing!') {
        console.error('[AUTH] Error fetching user profile:', err);
        setError(err as Error);
      }
      return null;
    }
  }, [ensureUserProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      
      if (!authUser) {
        setCurrentUser(null);
        return;
      }

      const profile = await fetchUserProfile(authUser);
      setCurrentUser(profile);
    } catch (err) {
      if (err instanceof Error && err.message !== 'Auth session missing!') {
        console.error('[AUTH] Error refreshing user:', err);
        setError(err as Error);
      }
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  const updateProfile = useCallback(async (updates: Partial<DatabaseUser>) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;
      await refresh();
    } catch (err) {
      console.error('[AUTH] Error updating profile:', err);
      throw err;
    }
  }, [currentUser, refresh]);

  useEffect(() => {
    if (!supabase) {
      console.error("[AUTH] Supabase client is not initialized. Check your environment variables.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setError(null);
        
        if (session?.user) {
          const profile = await fetchUserProfile(session.user);
          setCurrentUser(profile);
        } else {
          setCurrentUser(null);
        }
        
        setLoading(false);
      }
    );

    const handleFocus = async () => {
      await supabase.auth.refreshSession();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUserProfile]);

  // Update isReady state
  useEffect(() => {
    if (!loading) {
      if (!session?.user) {
        setIsReady(true);
      } else if (currentUser) {
        setIsReady(true);
      } else if (error) {
        setIsReady(true);
      }
    }
  }, [loading, session?.user, currentUser, error]);

  // Set up real-time subscription for user updates
  useEffect(() => {
    if (!currentUser) return;

    const userSubscription = supabase
      .channel(`user-updates-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${currentUser.id}`
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      userSubscription.unsubscribe();
    };
  }, [currentUser?.id, refresh]);

  const user = session?.user ?? null;
  const isAuthenticated = !!user && !!session;
  const hasProfile = !!currentUser;

  const requireAuth = useCallback(() => {
    if (!isAuthenticated) {
      throw new Error('User must be authenticated');
    }
    return { user: user!, session: session! };
  }, [isAuthenticated, user, session]);

  const requireProfile = useCallback(() => {
    if (!isAuthenticated || !hasProfile) {
      throw new Error('User must be authenticated with a complete profile');
    }
    return currentUser!;
  }, [isAuthenticated, hasProfile, currentUser]);
  
  const value = {
    user,
    session,
    loading,
    currentUser,
    error,
    signOut,
    refresh,
    updateProfile,
    isAuthenticated,
    hasProfile,
    isReady,
    requireAuth,
    requireProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // ✅ A more descriptive error message
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};