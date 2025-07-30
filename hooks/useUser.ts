// lib/hooks/useUser.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Use the generated type from Supabase
export type DatabaseUser = Database['public']['Tables']['users']['Row'];

// Define auth user type for initial auth response
interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Type guard to check if user data is valid
function isDatabaseUser(data: unknown): data is DatabaseUser {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data
  );
}

export function useUser() {
  const [user, setUser] = useState<DatabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch full user data from database
  const fetchUserData = async (authUser: AuthUser): Promise<DatabaseUser | null> => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();
      
      if (error) {
        console.error('Error fetching user data:', error);
        return null;
      }
      
      // Validate the data before returning
      if (isDatabaseUser(userData)) {
        return userData;
      }
      
      console.error('Invalid user data structure:', userData);
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial user
    const initializeUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const authUser = data.user as AuthUser | null;
        
        if (authUser && mounted) {
          const fullUser = await fetchUserData(authUser);
          setUser(fullUser);
        } else if (mounted) {
          setUser(null);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const authUser = session?.user ? {
          ...session.user,
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata,
          app_metadata: session.user.app_metadata
        } as AuthUser : null;
        
        if (authUser && mounted) {
          const fullUser = await fetchUserData(authUser);
          setUser(fullUser);
        } else if (mounted) {
          setUser(null);
        }
        
        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Remove supabase from dependencies as it's imported, not a prop

  return { user, loading };
}