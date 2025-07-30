'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { 
  X, 
  Send, 
  Heart, 
  MessageCircle,
  MoreHorizontal,
  Reply,
  ThumbsUp
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getZIndexClass } from '@/lib/constants/z-index';
import { toast } from '@/components/ui/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Comment {
  id: string;
  user_id: string;
  video_id: string;
  parent_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    display_name?: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    user_reacted: boolean;
  }>;
  replies_count?: number;
  replies?: Comment[];
  like_count?: number;
  user_liked?: boolean;
}

interface VideoCommentsOptimizedProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  initialCommentCount: number;
  onCommentCountChange: (count: number) => void;
}

export default function VideoCommentsOptimized({ 
  postId, 
  isOpen, 
  onClose, 
  initialCommentCount, 
  onCommentCountChange 
}: VideoCommentsOptimizedProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  // Load comments with real-time subscription
  useEffect(() => {
    if (!isOpen || !postId) return;

    const loadComments = async () => {
      setLoading(true);
      try {
        const { data: commentsData, error } = await supabase
          .from('wolfpack_comments')
          .select(`
            id,
            user_id,
            video_id,
            parent_id,
            content,
            created_at,
            updated_at,
            is_deleted,
            like_count,
            users:user_id (
              id,
              first_name,
              last_name,
              avatar_url,
              display_name
            )
          `)
          .eq('video_id', postId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Build threaded comment structure
        const commentsMap = new Map<string, Comment>();
        const rootComments: Comment[] = [];

        // First pass: create all comments
        commentsData?.forEach(comment => {
          const processedComment: Comment = {
            id: comment.id,
            user_id: comment.user_id,
            video_id: comment.video_id,
            parent_id: comment.parent_id,
            content: comment.content,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            is_deleted: comment.is_deleted,
            like_count: comment.like_count || 0,
            user: comment.users ? {
              id: comment.users.id,
              first_name: comment.users.first_name,
              last_name: comment.users.last_name,
              avatar_url: comment.users.avatar_url,
              display_name: comment.users.display_name
            } : undefined,
            replies: []
          };

          commentsMap.set(comment.id, processedComment);

          if (!comment.parent_id) {
            rootComments.push(processedComment);
          }
        });

        // Second pass: build reply structure
        commentsData?.forEach(comment => {
          if (comment.parent_id) {
            const parent = commentsMap.get(comment.parent_id);
            const child = commentsMap.get(comment.id);
            if (parent && child) {
              parent.replies = parent.replies || [];
              parent.replies.push(child);
            }
          }
        });

        // Sort root comments by created_at (newest first)
        rootComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Sort replies within each comment (oldest first)
        rootComments.forEach(comment => {
          if (comment.replies) {
            comment.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          }
        });

        if (mountedRef.current) {
          setComments(rootComments);
          const totalCount = commentsData?.length || 0;
          setCommentCount(totalCount);
          onCommentCountChange(totalCount);
        }

      } catch (error) {
        console.error('Error loading comments:', error);
        if (mountedRef.current) {
          toast({
            title: "Error",
            description: "Failed to load comments",
            variant: "destructive"
          });
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Set up real-time subscription for comments
    const channel = supabase
      .channel(`comments_${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wolfpack_comments',
          filter: `video_id=eq.${postId}`
        },
        async (payload) => {
          console.log('New comment:', payload);
          
          // Fetch the full comment data with user info
          const { data: newCommentData, error } = await supabase
            .from('wolfpack_comments')
            .select(`
              id,
              user_id,
              video_id,
              parent_id,
              content,
              created_at,
              updated_at,
              is_deleted,
              like_count,
              users:user_id (
                id,
                first_name,
                last_name,
                avatar_url,
                display_name
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && newCommentData && mountedRef.current) {
            const newComment: Comment = {
              id: newCommentData.id,
              user_id: newCommentData.user_id,
              video_id: newCommentData.video_id,
              parent_id: newCommentData.parent_id,
              content: newCommentData.content,
              created_at: newCommentData.created_at,
              updated_at: newCommentData.updated_at,
              is_deleted: newCommentData.is_deleted,
              like_count: newCommentData.like_count || 0,
              user: newCommentData.users ? {
                id: newCommentData.users.id,
                first_name: newCommentData.users.first_name,
                last_name: newCommentData.users.last_name,
                avatar_url: newCommentData.users.avatar_url,
                display_name: newCommentData.users.display_name
              } : undefined,
              replies: []
            };

            setComments(prev => {
              if (!newCommentData.parent_id) {
                // Root comment - add to beginning
                return [newComment, ...prev];
              } else {
                // Reply - add to parent's replies
                return prev.map(comment => {
                  if (comment.id === newCommentData.parent_id) {
                    return {
                      ...comment,
                      replies: [...(comment.replies || []), newComment]
                    };
                  }
                  return comment;
                });
              }
            });

            // Update comment count
            setCommentCount(prev => {
              const newCount = prev + 1;
              onCommentCountChange(newCount);
              return newCount;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wolfpack_comments',
          filter: `video_id=eq.${postId}`
        },
        (payload) => {
          console.log('Comment updated:', payload);
          
          if (mountedRef.current) {
            setComments(prev => updateCommentInTree(prev, payload.new.id, payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'wolfpack_comments',
          filter: `video_id=eq.${postId}`
        },
        (payload) => {
          console.log('Comment deleted:', payload);
          
          if (mountedRef.current) {
            setComments(prev => removeCommentFromTree(prev, payload.old.id));
            setCommentCount(prev => {
              const newCount = Math.max(0, prev - 1);
              onCommentCountChange(newCount);
              return newCount;
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    loadComments();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isOpen, postId, onCommentCountChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Helper function to update comment in nested structure
  const updateCommentInTree = (comments: Comment[], commentId: string, updates: any): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return { ...comment, ...updates };
      }
      if (comment.replies) {
        return {
          ...comment,
          replies: updateCommentInTree(comment.replies, commentId, updates)
        };
      }
      return comment;
    });
  };

  // Helper function to remove comment from nested structure
  const removeCommentFromTree = (comments: Comment[], commentId: string): Comment[] => {
    return comments
      .filter(comment => comment.id !== commentId)
      .map(comment => ({
        ...comment,
        replies: comment.replies ? removeCommentFromTree(comment.replies, commentId) : []
      }));
  };

  // Submit new comment
  const handleSubmitComment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    // Get current auth user in case the profile hasn't loaded yet
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!user && !authUser) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to comment',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // For new users, we need to get their database user ID
      let userDbId = user?.id;
      
      if (!userDbId && authUser) {
        const { data: userProfile, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', authUser.id)
          .single();
          
        if (userError) {
          console.error('Error finding user profile:', userError);
          toast({
            title: 'Error',
            description: 'Unable to find user profile. Please try refreshing the page.',
            variant: 'destructive'
          });
          return;
        }
        
        userDbId = userProfile.id;
      }

      if (!userDbId) {
        toast({
          title: 'Error',
          description: 'Unable to identify user for commenting. Please try signing out and back in.',
          variant: 'destructive'
        });
        return;
      }

      // Create comment
      const { error } = await supabase
        .from('wolfpack_comments')
        .insert({
          user_id: userDbId,
          video_id: postId,
          content: newComment.trim()
        });

      if (error) throw error;

      // Clear input
      setNewComment('');
      
      // The real-time subscription will handle adding the comment to the UI
      
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  }, [newComment, submitting, user, postId]);

  // Submit reply
  const handleSubmitReply = useCallback(async (e: React.FormEvent, parentCommentId: string) => {
    e.preventDefault();
    if (!replyContent.trim() || submittingReply) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!user && !authUser) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to reply',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmittingReply(true);
      
      let userDbId = user?.id;
      
      if (!userDbId && authUser) {
        const { data: userProfile, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', authUser.id)
          .single();
          
        if (userError) {
          toast({
            title: 'Error',
            description: 'Unable to find user profile. Please try refreshing the page.',
            variant: 'destructive'
          });
          return;
        }
        
        userDbId = userProfile.id;
      }

      if (!userDbId) {
        toast({
          title: 'Error',
          description: 'Unable to identify user for replying.',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('wolfpack_comments')
        .insert({
          user_id: userDbId,
          video_id: postId,
          content: replyContent.trim(),
          parent_id: parentCommentId
        });

      if (error) throw error;

      setReplyContent('');
      setReplyingTo(null);
      
    } catch (error: any) {
      console.error('Error submitting reply:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post reply',
        variant: 'destructive'
      });
    } finally {
      setSubmittingReply(false);
    }
  }, [replyContent, submittingReply, user, postId]);

  // Handle comment like
  const handleLikeComment = useCallback(async (commentId: string) => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like comments',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Toggle like (simplified - you can add more sophisticated like tracking)
      const { error } = await supabase.rpc('toggle_comment_like', {
        p_comment_id: commentId,
        p_user_id: user.id
      });

      if (error) throw error;

    } catch (error: any) {
      console.error('Error liking comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to like comment',
        variant: 'destructive'
      });
    }
  }, [user]);

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${getZIndexClass('modal')} flex items-end justify-center`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Comments ({commentCount})
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No comments yet</p>
              <p className="text-sm">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onLike={() => handleLikeComment(comment.id)}
                onReply={() => {
                  setReplyingTo(comment.id);
                  setTimeout(() => replyInputRef.current?.focus(), 100);
                }}
                replyingTo={replyingTo}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                onSubmitReply={handleSubmitReply}
                submittingReply={submittingReply}
                replyInputRef={replyInputRef}
                user={user}
              />
            ))
          )}
        </div>

        {/* Comment Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          {!user ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-2">Sign in to comment</p>
              <button 
                onClick={() => window.location.href = '/login'}
                className="text-blue-500 hover:text-blue-600 font-medium"
              >
                Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitComment} className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                <Image
                  src={user.avatar_url || '/icons/wolf-icon-light-screen.png'}
                  alt="Your avatar"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="p-2 text-blue-500 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Comment Item Component (simplified for space)
function CommentItem({ 
  comment, 
  onLike, 
  onReply, 
  replyingTo, 
  replyContent, 
  setReplyContent, 
  onSubmitReply, 
  submittingReply, 
  replyInputRef,
  user 
}: any) {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - commentTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
          <Image
            src={comment.user?.avatar_url || '/icons/wolf-icon-light-screen.png'}
            alt={comment.user?.display_name || 'User'}
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 text-sm">
              {comment.user?.display_name || 
               `${comment.user?.first_name || ''} ${comment.user?.last_name || ''}`.trim() || 
               'Anonymous'}
            </span>
            <span className="text-gray-500 text-xs">
              {formatTimeAgo(comment.created_at)}
            </span>
          </div>
          
          <p className="text-gray-800 text-sm leading-relaxed mb-2">
            {comment.content}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <button
              onClick={onLike}
              className="flex items-center gap-1 hover:text-red-500 transition-colors"
            >
              <Heart className="h-4 w-4" />
              {comment.like_count || 0}
            </button>
            
            <button
              onClick={onReply}
              className="flex items-center gap-1 hover:text-blue-500 transition-colors"
            >
              <Reply className="h-4 w-4" />
              Reply
            </button>
          </div>
          
          {/* Reply Input */}
          {replyingTo === comment.id && (
            <form 
              onSubmit={(e) => onSubmitReply(e, comment.id)}
              className="flex gap-2 mt-3"
            >
              <input
                ref={replyInputRef}
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`Reply to ${comment.user?.display_name || 'user'}...`}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submittingReply}
              />
              <button
                type="submit"
                disabled={!replyContent.trim() || submittingReply}
                className="text-blue-500 hover:text-blue-600 disabled:text-gray-300 p-1"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
          
          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-100">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onLike={() => onLike(reply.id)}
                  onReply={() => {}}
                  replyingTo={null}
                  replyContent=""
                  setReplyContent={() => {}}
                  onSubmitReply={() => {}}
                  submittingReply={false}
                  replyInputRef={replyInputRef}
                  user={user}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}