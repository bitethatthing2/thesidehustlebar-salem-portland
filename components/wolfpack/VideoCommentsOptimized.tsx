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
  parent_comment_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_pinned?: boolean;
  is_edited?: boolean;
  like_count?: number;
  likes_count?: number;
  users?: CommentUser | CommentUser[];
}

interface Comment {
  id: string;
  user_id: string;
  video_id: string;
  parent_comment_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_pinned?: boolean;
  is_edited?: boolean;
  user?: CommentUser;
  like_count: number;
  user_liked: boolean;
  reaction_count: number;
  replies: Comment[];
  replies_count: number;
}

interface VideoCommentsProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  initialCommentCount: number;
  onCommentCountChange: (count: number) => void;
}

// Service class
class WolfpackCommentsService {
  private supabase = supabase;
  
  async fetchComments(videoId: string, currentUserId?: string) {
    try {
      // First, try with public.users relationship (most recent schema)
      let { data: comments, error } = await this.supabase
        .from('wolfpack_comments')
        .select(`
          id,
          user_id,
          video_id,
          parent_comment_id,
          content,
          created_at,
          updated_at,
          is_deleted,
          like_count,
          likes_count,
          is_pinned,
          is_edited,
          users!left (
            id,
            first_name,
            last_name,
            avatar_url,
            display_name,
            username,
            profile_image_url
          )
        `)
        .eq('video_id', videoId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }) as { data: SupabaseComment[] | null, error: any };

      // If the query fails or returns no user data, try fetching comments and users separately
      if (error || !comments || comments.length === 0 || (comments.length > 0 && !comments[0].users)) {
        console.log('Primary query failed or returned no user data, trying fallback approach:', error?.message);
        
        // Fallback: Get comments first, then fetch user data separately
        const { data: commentsOnly, error: commentsError } = await this.supabase
          .from('wolfpack_comments')
          .select(`
            id,
            user_id,
            video_id,
            parent_comment_id,
            content,
            created_at,
            updated_at,
            is_deleted,
            like_count,
            likes_count,
            is_pinned,
            is_edited
          `)
          .eq('video_id', videoId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (commentsError) throw commentsError;
        
        if (commentsOnly && commentsOnly.length > 0) {
          const userIds = [...new Set(commentsOnly.map(c => c.user_id))];
          
          // Try to fetch from public.users first
          const { data: userData } = await this.supabase
            .from('users')
            .select('id, first_name, last_name, avatar_url, display_name, username, profile_image_url')
            .in('id', userIds);

          // Create a user lookup map
          const userMap = new Map();
          if (userData) {
            userData.forEach(user => userMap.set(user.id, user));
          }

          // Combine comments with user data
          comments = commentsOnly.map(comment => ({
            ...comment,
            users: userMap.get(comment.user_id) || null
          }));
        } else {
          comments = [];
        }
      }

      if (error) throw error;

      const commentIds = (comments || []).map(c => c.id);
      
      if (commentIds.length === 0) return [];

      const { data: reactions } = await this.supabase
        .from('wolfpack_comment_reactions')
        .select('comment_id, user_id, reaction_type')
        .in('comment_id', commentIds);

      const reactionMap = new Map<string, number>();
      const userReactionsSet = new Set<string>();
      
      (reactions || []).forEach(reaction => {
        const key = reaction.comment_id;
        reactionMap.set(key, (reactionMap.get(key) || 0) + 1);
        
        if (currentUserId && reaction.user_id === currentUserId) {
          userReactionsSet.add(reaction.comment_id);
        }
      });

      const transformedComments = (comments || []).map(comment => {
        // Handle users as either array or single object, with fallback for missing user data
        const userObject = Array.isArray(comment.users) ? comment.users[0] : comment.users;
        
        // Create fallback user object if user data is missing
        const fallbackUser = userObject || {
          id: comment.user_id,
          first_name: 'Unknown',
          last_name: 'User',
          avatar_url: null,
          display_name: 'Unknown User',
          username: 'unknown',
          profile_image_url: null
        };
        
        return {
          id: comment.id,
          user_id: comment.user_id,
          video_id: comment.video_id,
          parent_comment_id: comment.parent_comment_id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          is_deleted: comment.is_deleted,
          is_pinned: comment.is_pinned,
          is_edited: comment.is_edited,
          user: {
            id: fallbackUser.id,
            first_name: fallbackUser.first_name,
            last_name: fallbackUser.last_name,
            avatar_url: fallbackUser.profile_image_url || fallbackUser.avatar_url,
            display_name: fallbackUser.display_name || fallbackUser.username || 'Unknown User',
            username: fallbackUser.username || 'unknown',
            profile_image_url: fallbackUser.profile_image_url
          },
          like_count: comment.likes_count || comment.like_count || 0,
          user_liked: userReactionsSet.has(comment.id),
          reaction_count: reactionMap.get(comment.id) || 0,
          replies: [],
          replies_count: 0
        };
      });

      return this.organizeCommentsIntoTree(transformedComments);
    } catch (error) {
      console.error('Error in fetchComments:', error);
      throw error;
    }
  }

  private organizeCommentsIntoTree(comments: any[]) {
    const commentMap = new Map();
    const rootComments: any[] = [];

    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
          parent.replies_count = parent.replies.length;
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    rootComments.forEach(comment => {
      this.sortReplies(comment);
    });

    return rootComments;
  }

  private sortReplies(comment: any) {
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      comment.replies.forEach((reply: any) => this.sortReplies(reply));
    }
  }

  subscribeToComments(videoId: string, callback: (payload: any) => void): RealtimeChannel {
    return this.supabase
      .channel(`comments:${videoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wolfpack_comments',
          filter: `video_id=eq.${videoId}`
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

  const calculateTotalComments = (commentsList: Comment[]): number => {
    let count = 0;
    const countComments = (commentList: Comment[]) => {
      commentList.forEach(comment => {
        if (!comment.is_deleted) {
          count++;
          if (comment.replies && comment.replies.length > 0) {
            countComments(comment.replies);
          }
        }
      });
    };
    countComments(commentsList);
    return count;
  };

  const removeCommentFromTree = (commentsList: Comment[], commentId: string): Comment[] => {
    return commentsList
      .filter(comment => comment.id !== commentId)
      .map(comment => ({
        ...comment,
        replies: comment.replies ? removeCommentFromTree(comment.replies, commentId) : []
      }));
  };

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading comments for video:', postId);
      
      const commentsData = await commentsService.fetchComments(postId, user?.id);
      console.log('✅ Comments loaded:', commentsData?.length || 0, 'comments');
      
      if (mountedRef.current) {
        setComments(commentsData);
        const totalCount = calculateTotalComments(commentsData);
        setCommentCount(totalCount);
        onCommentCountChange(totalCount);
        
        console.log('📊 Comment count updated:', totalCount);
      }
    } catch (error) {
      console.error('❌ Error loading comments:', error);
      if (mountedRef.current) {
        toast({
          title: 'Error',
          description: `Failed to load comments: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive'
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId, user?.id, onCommentCountChange]);

  const handleCommentDelete = useCallback((deletedData: any) => {
    if (mountedRef.current) {
      setComments(prev => removeCommentFromTree(prev, deletedData.id));
      setCommentCount(prev => Math.max(0, prev - 1));
      onCommentCountChange(Math.max(0, commentCount - 1));
    }
  }, [commentCount, onCommentCountChange]);

  const setupRealtimeSubscription = useCallback(() => {
    channelRef.current = commentsService.subscribeToComments(postId, async (payload) => {
      if (payload.table === 'wolfpack_comments') {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          await loadComments();
        } else if (payload.eventType === 'DELETE') {
          handleCommentDelete(payload.old);
        }
      } else if (payload.table === 'wolfpack_comment_reactions') {
        await loadComments();
      }
    });
  }, [postId, loadComments, handleCommentDelete]);

  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
      setupRealtimeSubscription();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isOpen, postId, loadComments, setupRealtimeSubscription]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

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
      console.log('💬 Submitting comment:', {
        user_id: user.id,
        video_id: postId,
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
    <div
      className={`fixed inset-0 ${getZIndexClass('modal')} flex flex-col`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                className="text-red-500 hover:text-red-400 font-medium"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 justify-center pb-2 overflow-x-auto">
                {['❤️', '😂', '😍', '👏', '🔥', '💯', '🎉', '😢'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setNewComment(prev => prev + emoji)}
                    className="text-2xl p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                    aria-label={`Add ${emoji} emoji`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              
              <form onSubmit={handleSubmitComment} className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-gray-800 rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={submitting}
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className="p-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-full transition-colors disabled:cursor-not-allowed"
                  aria-label="Send comment"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-5 w-5 text-white" />
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
  onSubmitReply: (e: React.FormEvent, parentId: string) => void;
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
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
    if (diffInMinutes < 43200) return `${Math.floor(diffInMinutes / 10080)}w`;
    return `${Math.floor(diffInMinutes / 43200)}mo`;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-800">
          <Image
            src={getAvatarUrl(comment.user)}
            alt={getDisplayName(comment.user)}
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-white text-sm">
              {getDisplayName(comment.user)}
            </span>
            <span className="text-gray-400 text-xs">
              {formatTimeAgo(comment.created_at)}
            </span>
            {comment.is_edited && (
              <span className="text-gray-500 text-xs">(edited)</span>
            )}
            {comment.is_pinned && (
              <span className="text-red-500 text-xs">📌 Pinned</span>
            )}
          </div>
          
          <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
            {comment.content}
          </p>
          
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={onLike}
              disabled={isLiking}
              className={`flex items-center gap-1 transition-colors text-xs ${
                comment.user_liked 
                  ? 'text-red-500' 
                  : 'text-gray-400 hover:text-red-500'
              } ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={comment.user_liked ? 'Unlike comment' : 'Like comment'}
            >
              <Heart 
                className="h-4 w-4" 
                fill={comment.user_liked ? 'currentColor' : 'none'} 
              />
              {comment.like_count > 0 && <span>{comment.like_count}</span>}
            </button>
            
            {currentUser && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 text-gray-400 hover:text-blue-400 transition-colors text-xs"
                aria-label="Reply to comment"
              >
                <ReplyIcon className="h-4 w-4" />
                Reply
              </button>
            )}
          </div>
        </div>
      </div>
      
      {replyingTo === comment.id && currentUser && (
        <form onSubmit={(e) => onSubmitReply(e, comment.id)} className="ml-11 flex gap-2">
          <input
            ref={replyInputRef}
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 text-sm px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={submittingReply}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!replyContent.trim() || submittingReply}
            className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-full hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {submittingReply ? '...' : 'Reply'}
          </button>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </form>
      )}
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-11 space-y-3">
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
  );
}

export default VideoComments;