import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

// Debug logging helper
const authDebug = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUTH] ${message}`, data || '');
  }
};

// Create a singleton instance
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        storageKey: 'wolfpack-auth',
        storage: {
          // Use localStorage for better persistence
          getItem: (key) => {
            if (typeof window === 'undefined') return null;
            const item = window.localStorage.getItem(key);
            authDebug('Getting auth storage', { key, hasValue: !!item });
            return item;
          },
          setItem: (key, value) => {
            if (typeof window === 'undefined') return;
            authDebug('Setting auth storage', { key, valueLength: value?.length });
            window.localStorage.setItem(key, value);
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return;
            authDebug('Removing auth storage', { key });
            window.localStorage.removeItem(key);
          },
        },
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'X-Client-Info': 'wolfpack-web',
        },
      },
    }
  );

  // Set up auth state change listener
  const { data: { subscription } } = supabaseInstance.auth.onAuthStateChange(
    async (event, session) => {
      authDebug('Auth state changed', { event, hasSession: !!session });

      // Handle session updates
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          // Ensure the session is properly stored
          await supabaseInstance.auth.setSession(session);
          
          // Verify user profile exists
          const { data: userProfile } = await supabaseInstance
            .from('users')
            .select('id, auth_id')
            .eq('auth_id', session.user.id)
            .single();

          if (!userProfile) {
            authDebug('User profile not found, may need migration');
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        // Clear any app-specific data
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('wolfpack-user-cache');
        }
      }
    }
  );

  // Cleanup function for unmounting
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      subscription.unsubscribe();
    });
  }

  return supabaseInstance;
}

// Export the shared instance directly
export const supabase = createClient()

// For backward compatibility
export const getSupabaseBrowserClient = createClient

// Utility function to handle Supabase errors with proper typing
export function handleSupabaseError(error: unknown): {
  message: string
  status?: number
  code?: string
} {
  // Handle null/undefined
  if (!error) {
    return {
      message: 'An unknown error occurred',
      status: 500,
      code: 'UNKNOWN_ERROR',
    }
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('JWT')) {
      return {
        message: 'Authentication expired. Please sign in again.',
        status: 401,
        code: 'AUTH_EXPIRED',
      }
    }
    
    if (error.message.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection.',
        status: 0,
        code: 'NETWORK_ERROR',
      }
    }

    return {
      message: error.message,
      status: 500,
      code: 'ERROR',
    }
  }

  // Handle Supabase/Postgrest errors
  if (isSupabaseError(error)) {
    // Rate limiting
    if (error.status === 429) {
      return {
        message: 'Too many requests. Please try again later.',
        status: 429,
        code: 'RATE_LIMITED',
      }
    }

    return {
      message: error.message,
      status: error.status || 500,
      code: error.code || 'SUPABASE_ERROR',
    }
  }

  // Handle auth errors
  if (isAuthError(error)) {
    return {
      message: error.message,
      status: error.status || 401,
      code: error.code || 'AUTH_ERROR',
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      status: 500,
      code: 'STRING_ERROR',
    }
  }

  // Default fallback
  return {
    message: 'An unexpected error occurred',
    status: 500,
    code: 'UNKNOWN_ERROR',
  }
}

// Export types
export type { SupabaseError, PostgrestError, AuthError }