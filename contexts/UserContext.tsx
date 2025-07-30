'use client';

import { useState, useEffect, createContext, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// Database user type based on your schema
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

export interface UserContextType {
  currentUser: CurrentUser | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: Partial<DatabaseUser>) => Promise<void>;
}

// Export the context for use in the hook
export const UserContext = createContext<UserContextType>({
  currentUser: null,
  loading: true,
  error: null,
  refresh: async () => {},
  updateProfile: async () => {}
});

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

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const ensureUserProfile = async (authUser: User) => {
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
          console.error('Error creating user profile:', insertError);
          throw insertError;
        }
      }
    } catch (err) {
      console.error('Error ensuring user profile:', err);
      throw err;
    }
  };

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      
      if (!authUser) {
        setCurrentUser(null);
        return;
      }

      await ensureUserProfile(authUser);

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
        
        const transformedUser = transformDatabaseUser(directProfile as DatabaseUser, authUser);
        setCurrentUser(transformedUser);
      } else {
        const transformedUser = transformDatabaseUser(profile as DatabaseUser, authUser);
        setCurrentUser(transformedUser);
      }
    } catch (err) {
      // Don't log AuthSessionMissingError as it's expected when user is not logged in
      if (err instanceof Error && err.message !== 'Auth session missing!') {
        console.error('Error loading user:', err);
        setError(err as Error);
      }
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<DatabaseUser>) => {
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
      await loadUser();
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await loadUser();
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
          loadUser();
        }
      )
      .subscribe();

    return () => {
      userSubscription.unsubscribe();
    };
  }, [currentUser?.id]);

  return (
    <UserContext.Provider 
      value={{
        currentUser,
        loading,
        error,
        refresh: loadUser,
        updateProfile
      }}
    >
      {children}
    </UserContext.Provider>
  );
};