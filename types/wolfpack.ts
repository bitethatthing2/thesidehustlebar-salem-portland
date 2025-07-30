export interface PostCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (post: WolfpackPost) => void;
}

export interface WolfpackPost {
  id: string;
  user_id: string;
  caption: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number;
  like_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  auth_id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}