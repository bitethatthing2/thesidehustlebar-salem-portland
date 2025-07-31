'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Heart, 
  Send, 
  X as XIcon,
  Reply as ReplyIcon
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getZIndexClass } from '@/lib/constants/z-index';
import { toast } from '@/components/ui/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Types
interface CommentUser {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  display_name?: string;
  username?: string;
  profile_image_url?: string;
}

interface SupabaseComment {
  id: string;
  user_id: string;
  video_id: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
  users?: CommentUser | CommentUser[];
  replies?: SupabaseComment[];
  like_count?: number;
  user_liked?: boolean;
}

interface Comment extends SupabaseComment {
  user: CommentUser;
  replies: Comment[];
  like_count: number;
  user_liked: boolean;
}

interface VideoCommentsProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  initialCommentCount: number;
  onCommentCountChange?: (count: number) => void;
}

// Service class for comment operations
class WolfpackCommentsService {
  async fetchComments(postId: string, userId?: string): Promise<Comment[]> {
    try {
      console.log('🔍 Fetching comments for video:', postId);

      // Base query with user data
      let query = supabase
        .from('wolfpack_comments')
        .select(`
          id,
          user_id,
          video_id,
          content,
          created_at,
          parent_comment_id,
          users!wolfpack_comments_user_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url,
            display_name,
            username,
            profile_image_url
          )
        `)
        .eq('video_id', postId)
        .order('created_at', { ascending: true });

      const { data: comments, error } = await query;

      if (error) {
        console.error('❌ Error fetching comments:', error);
        throw error;
      }

      if (!comments || comments.length === 0) {
        console.log('📭 No comments found for video:', postId);
        return [];
      }

      console.log('✅ Raw comments fetched:', comments.length);

      // Get user IDs for batch fetching reactions
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const userMap = new Map();

      // Get comment IDs for batch fetching reactions
      const commentIds = (comments || []).map(c => c.id);
      const reactionMap = new Map<string, number>();
      const userReactionsSet = new Set<string>();

      // Batch fetch reactions if user is logged in
      if (userId && commentIds.length > 0) {
        const { data: reactions } = await supabase
          .from('wolfpack_comment_reactions')
          .select('comment_id, user_id')
          .in('comment_id', commentIds);

        if (reactions) {
          reactions.forEach(reaction => {
            const count = reactionMap.get(reaction.comment_id) || 0;
            reactionMap.set(reaction.comment_id, count + 1);
            
            if (reaction.user_id === userId) {
              userReactionsSet.add(reaction.comment_id);
            }
          });
        }
      }

      // Transform comments with proper typing
      const transformedComments = (comments || []).map(comment => {
        const userObject = Array.isArray(comment.users) ? comment.users[0] : comment.users;
        
        return {
          ...comment,
          user: userObject || {
            id: comment.user_id,
            first_name: 'Unknown',
            last_name: 'User'
          },
          replies: [] as Comment[],
          like_count: reactionMap.get(comment.id) || 0,
          user_liked: userReactionsSet.has(comment.id)
        } as Comment;
      });

      // Build nested structure
      const commentMap = new Map();
      const rootComments: Comment[] = [];

      // First pass: create map of all comments
      transformedComments.forEach(comment => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      // Second pass: build tree structure
      transformedComments.forEach(comment => {
        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies.push(commentMap.get(comment.id));
          }
        } else {
          rootComments.push(commentMap.get(comment.id));
        }
      });

      console.log('🌳 Comments tree built:', rootComments.length, 'root comments');
      return rootComments;

    } catch (error) {
      console.error('❌ Error in fetchComments:', error);
      throw error;
    }
  }

  // Subscribe to real-time comment changes
  subscribeToComments(postId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wolfpack_comments',
          filter: `video_id=eq.${postId}`
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wolfpack_comment_reactions'
        },
        callback
      )
      .subscribe();
  }
}

const commentsService = new WolfpackCommentsService();

// Main component
function VideoComments({ 
  postId, 
  isOpen, 
  onClose, 
  initialCommentCount, 
  onCommentCountChange 
}: VideoCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Helper function to calculate total comments including replies
  const calculateTotalComments = (commentsList: Comment[]): number => {
    const countComments = (commentList: Comment[]) => {
      return commentList.reduce((count, comment) => {
        return count + 1 + countComments(comment.replies || []);
      }, 0);
    };
    return countComments(commentsList);
  };

  // Helper function to remove comment from tree structure
  const removeCommentFromTree = (commentsList: Comment[], commentId: string): Comment[] => {
    return commentsList.reduce((acc: Comment[], comment) => {
      if (comment.id === commentId) {
        // Skip this comment (remove it)
        return acc;
      }
      
      // Process replies recursively
      const updatedComment = {
        ...comment,
        replies: removeCommentFromTree(comment.replies || [], commentId)
      };
      
      return [...acc, updatedComment];
    }, []);
  };

  // Load comments
  const loadComments = useCallback(async () => {
    if (!postId) return;
    
    try {
      setLoading(true);
      console.log('🔄 Loading comments for post:', postId);
      
      const commentsData = await commentsService.fetchComments(postId, user?.id);
      
      if (mountedRef.current) {
        setComments(commentsData);
        const totalCount = calculateTotalComments(commentsData);
        setCommentCount(totalCount);
        onCommentCountChange?.(totalCount);
        console.log('✅ Comments loaded:', commentsData.length, 'root comments, total:', totalCount);
      }
    } catch (error) {
      console.error('❌ Error loading comments:', error);
      if (mountedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to load comments',
          variant: 'destructive'
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId, user?.id, onCommentCountChange]);

  // Handle real-time comment deletion
  const handleCommentDelete = useCallback((deletedData: any) => {
    console.log('🗑️ Comment deleted:', deletedData);
    if (deletedData.old?.id) {
      setComments(prevComments => {
        const updatedComments = removeCommentFromTree(prevComments, deletedData.old.id);
        const newTotal = calculateTotalComments(updatedComments);
        setCommentCount(newTotal);
        onCommentCountChange?.(newTotal);
        return updatedComments;
      });
    }
  }, [onCommentCountChange]);

  // Setup real-time subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!postId) return;

    console.log('🔔 Setting up real-time subscription for post:', postId);
    
    try {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }

      channelRef.current = commentsService.subscribeToComments(postId, (payload) => {
        console.log('📡 Real-time update received:', payload);
        
        if (payload.eventType === 'DELETE') {
          handleCommentDelete(payload);
          return;
        }

        // For INSERT and UPDATE, reload comments to get the full structure
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setTimeout(() => {
            if (mountedRef.current) {
              loadComments();
            }
          }, 500);
        }
      });
    } catch (error) {
      console.error('❌ Error setting up real-time subscription:', error);
    }
  }, [postId, loadComments, handleCommentDelete]);

  // Initial load and subscription setup
  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
      setupRealtimeSubscription();
    }

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [isOpen, postId, loadComments, setupRealtimeSubscription]);

  // Submit new comment
  const handleSubmitComment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to comment',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmitting(true);

      console.log('📝 Submitting comment:', {
        userId: user.id,
        postId,
        content: newComment.trim()
      });

      const { error } = await supabase
        .from('wolfpack_comments')
        .insert({
          user_id: user.id,
          video_id: postId,
          content: newComment.trim()
        });

      if (error) {
        console.error('❌ Comment submission error:', error);
        throw error;
      }

      console.log('✅ Comment submitted successfully');
      setNewComment('');
      toast({
        title: 'Success',
        description: 'Comment posted!',
      });

      // Reload comments to show the new comment
      setTimeout(() => loadComments(), 500);

    } catch (error: any) {
      console.error('❌ Error submitting comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  }, [newComment, submitting, user, postId, loadComments]);

  // Submit reply
  const handleSubmitReply = useCallback(async (e: React.FormEvent, parentCommentId: string) => {
    e.preventDefault();
    if (!replyContent.trim() || submittingReply) return;

    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to reply',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmittingReply(true);

      const { error } = await supabase
        .from('wolfpack_comments')
        .insert({
          user_id: user.id,
          video_id: postId,
          content: replyContent.trim(),
          parent_comment_id: parentCommentId
        });

      if (error) throw error;

      setReplyContent('');
      setReplyingTo(null);
      
      toast({
        title: 'Success',
        description: 'Reply posted!',
      });

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

  // Handle like/unlike comment
  const handleLikeComment = useCallback(async (commentId: string) => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like comments',
        variant: 'destructive'
      });
      return;
    }

    if (likingCommentId) return;

    try {
      setLikingCommentId(commentId);

      const { data: existingReaction } = await supabase
        .from('wolfpack_comment_reactions')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingReaction) {
        const { error } = await supabase
          .from('wolfpack_comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wolfpack_comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            reaction_type: '❤️'
          });
          
        if (error) throw error;
      }

    } catch (error: any) {
      console.error('Error liking comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive'
      });
    } finally {
      setLikingCommentId(null);
    }
  }, [user, likingCommentId]);

  const getDisplayName = useCallback((userInfo: Comment['user']) => {
    if (!userInfo) return 'Anonymous';
    
    if (userInfo.display_name) return userInfo.display_name;
    if (userInfo.username) return `@${userInfo.username}`;
    
    const fullName = `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim();
    return fullName || 'Anonymous';
  }, []);

  const getAvatarUrl = useCallback((userInfo: Comment['user']) => {
    if (!userInfo) return '/icons/wolf-icon.png';
    return userInfo.avatar_url || '/icons/wolf-icon.png';
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1" onClick={onClose}></div>
      
      <div className="bg-black text-white flex flex-col rounded-t-2xl max-h-[70vh] animate-slide-up">
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 bg-gray-600 rounded-full"></div>
        </div>
        
        <div className="flex items-center justify-between px-4 pb-4">
          <h3 className="text-lg font-semibold text-white">
            {commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close comments"
          >
            <XIcon className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 max-h-[40vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-600" />
              <p className="text-white">No comments yet</p>
              <p className="text-sm text-gray-400">Be the first to comment!</p>
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
                currentUser={user}
                isLiking={likingCommentId === comment.id}
                getDisplayName={getDisplayName}
                getAvatarUrl={getAvatarUrl}
                handleLikeComment={handleLikeComment}
                setReplyingTo={setReplyingTo}
                likingCommentId={likingCommentId}
              />
            ))
          )}
        </div>

        <div className="border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm p-3 pb-safe">
          {!user ? (
            <div className="text-center py-4">
              <p className="text-gray-400 mb-2">Sign in to comment</p>
              <button
                onClick={() => window.location.href = '/login'}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <form onSubmit={handleSubmitComment} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                  disabled={submitting}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  onLike: () => void;
  onReply: () => void;
  replyingTo: string | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: (e: React.FormEvent, parentCommentId: string) => void;
  submittingReply: boolean;
  replyInputRef: React.RefObject<HTMLInputElement>;
  currentUser: any;
  isLiking: boolean;
  getDisplayName: (user: Comment['user']) => string;
  getAvatarUrl: (user: Comment['user']) => string;
  handleLikeComment: (commentId: string) => void;
  setReplyingTo: (id: string | null) => void;
  likingCommentId: string | null;
}

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
  currentUser,
  isLiking,
  getDisplayName,
  getAvatarUrl,
  handleLikeComment,
  setReplyingTo,
  likingCommentId
}: CommentItemProps) {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - commentTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return commentTime.toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
            <Image
              src={getAvatarUrl(comment.user)}
              alt={getDisplayName(comment.user)}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white text-sm">
              {getDisplayName(comment.user)}
            </span>
            <span className="text-gray-400 text-xs">
              {formatTimeAgo(comment.created_at)}
            </span>
          </div>
          
          <p className="text-gray-100 text-sm leading-relaxed break-words">
            {comment.content}
          </p>
          
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={onLike}
              disabled={isLiking}
              className={`flex items-center gap-1 text-xs transition-colors ${
                comment.user_liked 
                  ? 'text-red-500 hover:text-red-400' 
                  : 'text-gray-400 hover:text-red-400'
              } ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Heart className={`h-4 w-4 ${comment.user_liked ? 'fill-current' : ''}`} />
              {comment.like_count > 0 && (
                <span>{comment.like_count}</span>
              )}
            </button>
            
            <button
              onClick={onReply}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-400 transition-colors"
            >
              <ReplyIcon className="h-4 w-4" />
              Reply
            </button>
          </div>
          
          {/* Reply Input */}
          {replyingTo === comment.id && (
            <form 
              onSubmit={(e) => onSubmitReply(e, comment.id)}
              className="mt-3 flex gap-2"
            >
              <input
                ref={replyInputRef}
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`Reply to ${getDisplayName(comment.user)}...`}
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                disabled={submittingReply}
              />
              <button
                type="submit"
                disabled={!replyContent.trim() || submittingReply}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors text-sm"
              >
                {submittingReply ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Reply'
                )}
              </button>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-gray-400 hover:text-white px-2 py-2 transition-colors text-sm"
              >
                Cancel
              </button>
            </form>
          )}
          
          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-2 border-l border-gray-700 pl-3">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onLike={() => handleLikeComment(reply.id)}
                  onReply={() => {
                    setReplyingTo(reply.id);
                    setTimeout(() => replyInputRef.current?.focus(), 100);
                  }}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  onSubmitReply={onSubmitReply}
                  submittingReply={submittingReply}
                  replyInputRef={replyInputRef}
                  currentUser={currentUser}
                  isLiking={likingCommentId === reply.id}
                  getDisplayName={getDisplayName}
                  getAvatarUrl={getAvatarUrl}
                  handleLikeComment={handleLikeComment}
                  setReplyingTo={setReplyingTo}
                  likingCommentId={likingCommentId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoComments;