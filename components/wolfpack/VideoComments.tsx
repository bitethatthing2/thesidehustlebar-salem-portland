'use client';

import { useState, useEffect, useRef } from 'react';
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
import { wolfpackSocialService } from '@/lib/services/wolfpack';
import { toast } from '@/components/ui/use-toast';
import { useMultipleFeatureFlags } from '@/hooks/useFeatureFlag';
import { FEATURE_FLAGS } from '@/lib/services/feature-flags.service';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  replies_count: number;
  parent_id?: string;
  replies?: Comment[];
  user_profile?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    verified?: boolean;
  };
  is_liked?: boolean;
}

interface VideoCommentsProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  initialCommentCount: number;
  onCommentCountChange?: (count: number) => void;
}

// CommentItem component for rendering individual comments and their replies
interface CommentItemProps {
  comment: Comment;
  onLike: (commentId: string) => void;
  onReply: (commentId: string) => void;
  replyingTo: string | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: (e: React.FormEvent, parentCommentId: string) => void;
  submittingReply: boolean;
  replyInputRef: React.RefObject<HTMLInputElement>;
  formatTimeAgo: (timestamp: string) => string;
  user: any;
  depth: number;
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
  formatTimeAgo,
  user,
  depth
}: CommentItemProps) {
  const maxDepth = 3; // Limit nesting depth to avoid UI issues
  const isReplying = replyingTo === comment.id;
  
  return (
    <div className={`${depth > 0 ? 'ml-4 md:ml-8 border-l border-gray-200 pl-2 md:pl-4' : ''} py-2`}>
      <div className="flex gap-2 md:gap-3">
        <Avatar className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0">
          <Image
            src={comment.user_profile?.avatar_url || '/icons/wolf-icon-light-screen.png'}
            alt="User avatar"
            width={40}
            height={40}
            className="rounded-full"
          />
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <span className="text-gray-900 font-semibold text-sm mr-2">
              {comment.user_profile?.username || 'user'}
            </span>
            {comment.user_profile?.verified && (
              <span className="text-blue-500 mr-2">✓</span>
            )}
            <span className="text-gray-500 text-xs">
              {formatTimeAgo(comment.created_at)}
            </span>
          </div>
          
          <p className="text-gray-900 text-sm leading-normal mb-2">
            {comment.content}
          </p>
          
          <div className="flex items-center gap-4 md:gap-6 mb-2">
            <button
              onClick={() => onLike(comment.id)}
              className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Heart 
                className={`h-4 w-4 ${
                  comment.is_liked ? 'fill-red-500 text-red-500' : ''
                }`} 
              />
              <span className="text-xs">{comment.likes_count}</span>
            </button>
            
            {depth < maxDepth && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-gray-500 hover:text-gray-700 transition-colors text-xs font-medium py-1 px-2 rounded hover:bg-gray-100"
              >
                Reply
              </button>
            )}
          </div>
          
          {/* Reply input field */}
          {isReplying && user && (
            <form onSubmit={(e) => onSubmitReply(e, comment.id)} className="mt-3 mb-4">
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden flex-shrink-0 mt-1">
                  <Image
                    src={user?.user_metadata?.avatar_url || '/icons/wolf-icon-light-screen.png'}
                    alt="Your avatar"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex gap-2">
                  <Input
                    ref={replyInputRef}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Reply to ${comment.user_profile?.username || 'user'}...`}
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-0 rounded-full px-3 py-2 text-sm min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!replyContent.trim() || submittingReply}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 disabled:text-gray-400 transition-colors rounded-full hover:bg-gray-100 flex-shrink-0"
                  >
                    {submittingReply ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
          
          {/* Render replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 md:mt-3">
              {comment.replies.map((reply) => (
                <CommentItem 
                  key={reply.id}
                  comment={reply}
                  onLike={onLike}
                  onReply={onReply}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  onSubmitReply={onSubmitReply}
                  submittingReply={submittingReply}
                  replyInputRef={replyInputRef}
                  formatTimeAgo={formatTimeAgo}
                  user={user}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VideoComments({ postId, isOpen, onClose, initialCommentCount, onCommentCountChange }: VideoCommentsProps) {
  const { user } = useAuth();
  
  // Feature flag integration
  const { features: socialFeatures, loading: featuresLoading } = useMultipleFeatureFlags([
    FEATURE_FLAGS.WOLFPACK_COMMENTS,
    FEATURE_FLAGS.WOLFPACK_LIKES
  ]);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isOpen && postId) {
      fetchComments();
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 100);
      
      // Subscribe to real-time updates
      unsubscribeRef.current = wolfpackSocialService.subscribeToComments(
        postId,
        async (updatedComments) => {
          console.log('Real-time subscription triggered. Raw comments:', updatedComments);
          
          try {
            // Convert to the component's comment format with reaction checking
            const allFormattedComments = await Promise.all(
              updatedComments.map(async (c) => {
                let is_liked = false;
                let likes_count = 0;
                
                if (user?.id) {
                  try {
                    is_liked = await wolfpackSocialService.hasUserReacted(c.id, user.id, '❤️');
                    const reactions = await wolfpackSocialService.getCommentReactions(c.id);
                    likes_count = reactions.filter(r => r.reaction_type === '❤️').length;
                  } catch (error) {
                    console.error('Error checking reaction status:', error);
                  }
                }
                
                return {
                  id: c.id,
                  user_id: c.user_id,
                  content: c.content,
                  created_at: c.created_at,
                  parent_id: c.parent_id,
                  likes_count,
                  replies_count: c.replies_count || 0,
                  replies: [],
                  user_profile: {
                    first_name: c.user?.first_name,
                    last_name: c.user?.last_name,
                    username: `${c.user?.first_name || ''} ${c.user?.last_name || ''}`.trim() || 'User',
                    avatar_url: c.user?.avatar_url,
                    verified: true
                  },
                  is_liked
                };
              })
            );
            
            console.log('Formatted comments before hierarchy:', allFormattedComments);
            
            // Organize into hierarchy
            const formattedComments = organizeCommentsHierarchy(allFormattedComments);
            
            console.log('Final hierarchical comments:', formattedComments);
            
            setComments(formattedComments);
          } catch (error) {
            console.error('Error processing real-time comment updates:', error);
          }
        },
        user?.id
      );
    }
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isOpen, postId, user?.id]);

  // Notify parent when comment count changes
  useEffect(() => {
    if (onCommentCountChange) {
      onCommentCountChange(comments.length);
    }
  }, [comments.length, onCommentCountChange]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching comments for post:', postId);
      
      const fetchedComments = await wolfpackSocialService.getComments(postId, user?.id);
      
      console.log('Raw fetched comments:', fetchedComments);
      
      // Convert to the component's comment format and get reaction status
      const allFormattedComments = await Promise.all(
        fetchedComments.map(async (c) => {
          // Check if current user has liked this comment
          let is_liked = false;
          let likes_count = 0;
          
          if (user?.id) {
            try {
              is_liked = await wolfpackSocialService.hasUserReacted(c.id, user.id, '❤️');
              const reactions = await wolfpackSocialService.getCommentReactions(c.id);
              likes_count = reactions.filter(r => r.reaction_type === '❤️').length;
            } catch (error) {
              console.error('Error checking reaction status:', error);
            }
          }
          
          return {
            id: c.id,
            user_id: c.user_id,
            content: c.content,
            created_at: c.created_at,
            parent_id: c.parent_id,
            likes_count,
            replies_count: c.replies_count || 0,
            replies: [],
            user_profile: {
              first_name: c.user?.first_name,
              last_name: c.user?.last_name,
              username: `${c.user?.first_name || ''} ${c.user?.last_name || ''}`.trim() || 'User',
              avatar_url: c.user?.avatar_url,
              verified: true
            },
            is_liked
          };
        })
      );
      
      console.log('Formatted comments before hierarchy:', allFormattedComments);
      
      // Organize comments into hierarchical structure
      const formattedComments = organizeCommentsHierarchy(allFormattedComments);
      
      console.log('Final hierarchical comments:', formattedComments);
      
      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
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
        // Try to get the user profile by auth ID
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
      
      const result = await wolfpackSocialService.createComment(
        postId,
        userDbId,
        newComment.trim()
      );
      
      if (result.success && result.comment) {
        setNewComment('');
        // The real-time subscription will update the comments list
        toast({
          title: 'Comment posted!',
          description: 'Your comment has been added'
        });
      } else {
        throw new Error('Failed to create comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to like comments',
        variant: 'destructive'
      });
      return;
    }
    
    // Get the current comment to check like status
    const currentComment = comments.find(c => c.id === commentId);
    if (!currentComment) return;
    
    // Optimistic update
    setComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { 
              ...comment, 
              is_liked: !comment.is_liked,
              likes_count: comment.is_liked ? comment.likes_count - 1 : comment.likes_count + 1
            }
          : comment
      )
    );
    
    // Send to server
    const result = currentComment.is_liked 
      ? await wolfpackSocialService.removeCommentReaction(commentId, user.id, '❤️')
      : await wolfpackSocialService.addCommentReaction(commentId, user.id, '❤️');
      
    if (!result.success) {
      // Revert on error
      setComments(prev => 
        prev.map(c => 
          c.id === commentId 
            ? { 
                ...c, 
                is_liked: !c.is_liked,
                likes_count: c.is_liked ? c.likes_count - 1 : c.likes_count + 1
              }
            : c
        )
      );
      
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive'
      });
    }
  };
  
  // Helper function to organize comments into hierarchical structure
  const organizeCommentsHierarchy = (allComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];
    
    // First pass: create a map of all comments
    allComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    
    // Second pass: organize into hierarchy
    allComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parent_id) {
        // This is a reply, add it to parent's replies
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies!.push(commentWithReplies);
        }
      } else {
        // This is a root comment
        rootComments.push(commentWithReplies);
      }
    });
    
    // Sort root comments by creation date (newest first)
    rootComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Sort replies within each comment by creation date (oldest first)
    const sortReplies = (comment: Comment) => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        comment.replies.forEach(sortReplies);
      }
    };
    
    rootComments.forEach(sortReplies);
    
    return rootComments;
  };
  
  const handleSubmitReply = async (e: React.FormEvent, parentCommentId: string) => {
    e.preventDefault();
    if (!replyContent.trim() || submittingReply) return;

    // Get current auth user in case the profile hasn't loaded yet
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
      
      // For new users, we need to get their database user ID
      let userDbId = user?.id;
      
      if (!userDbId && authUser) {
        // Try to get the user profile by auth ID
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
          description: 'Unable to identify user for replying. Please try signing out and back in.',
          variant: 'destructive'
        });
        return;
      }
      
      console.log('Submitting reply:', {
        postId,
        userId: userDbId,
        content: replyContent.trim(),
        parentCommentId
      });
      
      const result = await wolfpackSocialService.createComment(
        postId,
        userDbId,
        replyContent.trim(),
        parentCommentId
      );
      
      console.log('Reply submission result:', result);
      
      if (result.success && result.comment) {
        setReplyContent('');
        setReplyingTo(null);
        
        // Add optimistic update for immediate feedback
        if (result.comment) {
          console.log('Adding optimistic reply:', result.comment);
          
          // Create the formatted reply comment
          const formattedReply = {
            id: result.comment.id,
            user_id: result.comment.user_id,
            content: result.comment.content,
            created_at: result.comment.created_at,
            parent_id: result.comment.parent_id,
            likes_count: 0,
            replies_count: 0,
            replies: [],
            user_profile: {
              first_name: result.comment.user?.first_name,
              last_name: result.comment.user?.last_name,
              username: `${result.comment.user?.first_name || ''} ${result.comment.user?.last_name || ''}`.trim() || 'User',
              avatar_url: result.comment.user?.avatar_url,
              verified: true
            },
            is_liked: false
          };
          
          // Add reply to parent comment immediately
          setComments(prevComments => {
            const addReplyToComments = (comments: Comment[]): Comment[] => {
              return comments.map(comment => {
                if (comment.id === parentCommentId) {
                  return {
                    ...comment,
                    replies: [...(comment.replies || []), formattedReply]
                  };
                }
                // Check nested replies
                if (comment.replies && comment.replies.length > 0) {
                  return {
                    ...comment,
                    replies: addReplyToComments(comment.replies)
                  };
                }
                return comment;
              });
            };
            
            return addReplyToComments(prevComments);
          });
        }
        
        toast({
          title: 'Reply posted!',
          description: 'Your reply has been added'
        });
      } else {
        console.error('Reply submission failed:', result);
        throw new Error('Failed to create reply');
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to post reply',
        variant: 'destructive'
      });
    } finally {
      setSubmittingReply(false);
    }
  };
  
  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId);
    // Focus the reply input after it appears
    setTimeout(() => replyInputRef.current?.focus(), 100);
  };
  
  const handleEmojiReaction = (emoji: string) => {
    setNewComment(prev => prev + emoji);
    setShowEmojiPicker(false);
    // Focus the input after adding emoji
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  if (!isOpen) return null;

  console.log('VideoComments render:', { 
    isOpen, 
    postId, 
    user: !!user, 
    userId: user?.id,
    commentsLength: comments.length,
    loading,
    newComment,
    userMetadata: user?.user_metadata
  });

  return (
    <div className={`fixed inset-0 ${getZIndexClass('NOTIFICATION')} flex flex-col`}>
      {/* Video background (blurred) */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Comments overlay - slides up from bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col max-h-[80vh] animate-slide-up">
        {/* TikTok-style Header */}
        <div className="flex items-center justify-center p-4 relative">
          <div className="w-12 h-1 bg-gray-400 rounded-full absolute top-2"></div>
          <h2 className="text-gray-900 text-lg font-semibold mt-2">
            {comments.length} comments
          </h2>
          <button
            onClick={onClose}
            className="absolute right-4 text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 space-y-2 md:space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No comments yet</p>
              <p className="text-gray-500 text-sm">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem 
                key={comment.id}
                comment={comment}
                onLike={handleLikeComment}
                onReply={handleReplyClick}
                replyingTo={replyingTo}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                onSubmitReply={handleSubmitReply}
                submittingReply={submittingReply}
                replyInputRef={replyInputRef}
                formatTimeAgo={formatTimeAgo}
                user={user}
                depth={0}
              />
            ))
          )}
        </div>


        {/* Comment Input - TikTok Style */}
        <div className="border-t border-gray-200 bg-white sticky bottom-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
          <div className="p-3 md:p-4 pt-3">
            {!user ? (
            <div>
              <div className="text-center py-2 mb-3">
                <p className="text-gray-500 text-sm mb-2">Sign in to comment</p>
                <button className="text-purple-600 text-sm font-medium">
                  Sign In
                </button>
              </div>
              {/* Show input anyway for testing */}
              <form className="flex gap-2 md:gap-3 items-center opacity-50">
                <div className="w-8 h-8 md:w-9 md:h-9 bg-gray-300 rounded-full flex-shrink-0"></div>
                <input 
                  type="text"
                  placeholder="Sign in to comment..."
                  disabled
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-500 rounded-full px-3 md:px-4 py-2 md:py-3 text-sm min-w-0"
                />
                <button type="button" disabled className="p-2 text-gray-400 flex-shrink-0">
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmitComment} className="flex gap-2 md:gap-3 items-center">
              {/* User Avatar */}
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                <Image
                  src={user?.user_metadata?.avatar_url || '/icons/wolf-icon-light-screen.png'}
                  alt="Your avatar"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
            
              {/* Input Container */}
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add comment..."
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-0 rounded-full px-3 md:px-4 py-2 md:py-3 pr-20 md:pr-24 text-sm min-w-0"
                />
                
                {/* Emoji picker - positioned relative to entire form */}
                {showEmojiPicker && (
                  <>
                    {/* Backdrop to close picker */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowEmojiPicker(false)}
                    />
                    {/* Emoji picker */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-xl shadow-xl border p-3 grid grid-cols-8 gap-2 z-50 w-80">
                      {['😀', '😄', '😎', '😍', '🤣', '😢', '😡', '🤯',
                        '👍', '👎', '👏', '🙌', '❤️', '🔥', '🎉', '🎆',
                        '🐺', '🍻', '🍸', '🍹', '🍾', '🎵', '🎶', '💯'].map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => handleEmojiReaction(e)}
                          className="w-8 h-8 hover:bg-gray-100 rounded-lg flex items-center justify-center text-xl transition-colors"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                
                {/* Action Buttons Inside Input */}
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    title="Mention someone"
                  >
                    <span className="text-lg font-bold">@</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    title="Add emoji"
                  >
                    <span className="text-lg">😊</span>
                  </button>
                  <button
                    type="button"
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    title="Add photo"
                  >
                    <span className="text-lg">📷</span>
                  </button>
                </div>
              </div>
              
              {/* Send Button */}
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-700 disabled:text-gray-400 transition-colors rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                ) : (
                  <Send className="h-5 w-5" />
                )}
            </button>
          </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}