// Re-export user types from the context for use throughout the app
export type { CurrentUser } from '@/contexts/UserContext';

/**
 * Legacy types - kept for backward compatibility
 * @deprecated Use CurrentUser from UserContext instead
 */
export interface AuthUser {
  id: string;
  email: string;
}

export interface PublicUser {
  id: string;
  auth_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  profile_image_url?: string;
  wolfpack_status?: string;
  wolf_emoji?: string;
  created_at?: string;
  updated_at?: string;
}