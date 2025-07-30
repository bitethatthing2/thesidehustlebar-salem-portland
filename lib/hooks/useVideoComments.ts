import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getAppUserId } from '@/lib/utils/auth-helpers';

export interface VideoComment {
  id: string;
  user_id: string;
  video_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  user?: {
    username: string;
    display_name: string;
    avatar_url: string;
    first_name: string;
    last_name: string;
  };
  replies?: VideoComment[];
}

interface UseVideoCommentsReturn {
  comments: VideoComment[];
  loading: boolean;
  error: string | null;
  addComment: (content: string) => Promise<{ success: boolean; data?: any; error?: any }>;
  deleteComment: (commentId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useVideoComments(videoId: string): UseVideoCommentsReturn {
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('wolfpack_comments')
        .select(`
          *,
          user:users!wolfpack_comments_user_id_fkey (
            id,
            display_name,
            username,
            avatar_url,
            profile_image_url
          )
        `)
        .eq('video_id', videoId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error loading comments:', fetchError);
        setError('Failed to load comments');
        return;
      }

      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  // Add comment
  const addComment = useCallback(async (content: string) => {
    try {
      // Get the app user ID (maps from auth.users to public.users)
      const appUserId = await getAppUserId(supabase);
      if (!appUserId) {
        throw new Error('Not authenticated or user not found');
      }

      const { data, error } = await supabase
        .from('wolfpack_comments')
        .insert({
          video_id: videoId,
          user_id: appUserId, // Use app user ID
          content: content.trim()
        })
        .select(`
          *,
          user:users!wolfpack_comments_user_id_fkey (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Add to local state
      setComments(prev => [data, ...prev]);
      return { success: true, data };
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
      return { success: false, error };
    }
  }, [videoId]);

  const deleteComment = async (commentId: string): Promise<boolean> => {
    try {
      const appUserId = await getAppUserId(supabase);
      if (!appUserId) {
        throw new Error('Not authenticated or user not found');
      }

      const { error } = await supabase
        .from('wolfpack_comments')
        .update({ is_deleted: true })
        .eq('id', commentId)
        .eq('user_id', appUserId);

      if (error) throw error;

      // Remove from local state
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
      return false;
    }
  };

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return { 
    comments, 
    loading, 
    error,
    addComment, 
    deleteComment,
    refetch: loadComments 
  };
}