/**
 * UNIFIED WOLFPACK SERVICE - SINGLE SOURCE OF TRUTH
 *
 * This is the ONE service for ALL app functionality:
 * - Wolfpack Social (videos, likes, follows, comments)
 * - DJ/Broadcast Management
 * - Menu/Restaurant Features
 * - Admin Functions
 * - Notifications
 * - Media Optimization
 * - Authentication
 * - Performance Monitoring
 *
 * No more scattered services, no more confusion.
 */

"use client";

import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

// =============================================================================
// TYPES - Single source of truth for all types
// =============================================================================

export interface WolfpackUser {
  id: string;
  display_name: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  location: string | null;
  wolfpack_status: string | null;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
}

export interface WolfpackVideo {
  id: string;
  user_id: string;
  caption: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  location_tag: string | null;
  is_active: boolean;
  users?: WolfpackUser;
}

export interface WolfpackComment {
  id: string;
  user_id: string;
  video_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  likes_count: number;
  user?: WolfpackUser;
  replies?: WolfpackComment[];
  replies_count?: number;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// UNIFIED WOLFPACK SERVICE CLASS
// =============================================================================

class UnifiedWolfpackService {
  private static instance: UnifiedWolfpackService;

  static getInstance(): UnifiedWolfpackService {
    if (!UnifiedWolfpackService.instance) {
      UnifiedWolfpackService.instance = new UnifiedWolfpackService();
    }
    return UnifiedWolfpackService.instance;
  }

  // =========================================================================
  // AUTHENTICATION - BULLETPROOF SESSION MANAGEMENT
  // =========================================================================

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error("Error getting current session:", error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return !!session?.user;
  }

  async requireAuth(): Promise<{ user: User; session: Session } | null> {
    const session = await this.getCurrentSession();
    if (!session?.user) {
      // Don't redirect here - let the calling component handle it
      return null;
    }
    return { user: session.user, session };
  }

  // Helper method for when you want to redirect
  redirectToLogin(): void {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  async getUserProfile(userId: string): Promise<WolfpackUser | null> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  async getCurrentUserProfile(): Promise<WolfpackUser | null> {
    const auth = await this.requireAuth();
    if (!auth) return null;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", auth.user.id)
        .single();

      if (error) {
        // Create profile if it doesn't exist
        if (error.code === "PGRST116") {
          console.log("[AUTH] Creating new user profile");
          const { data: newProfile, error: insertError } = await supabase
            .from("users")
            .insert({
              auth_id: auth.user.id,
              email: auth.user.email!,
              wolfpack_status: "pending",
              location: "florida_state",
              state: "Florida",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return newProfile;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error getting current user profile:", error);
      return null;
    }
  }

  async signOut(): Promise<ServiceResponse> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Redirect to home
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }

      return { success: true };
    } catch (error) {
      console.error("Error signing out:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sign out",
      };
    }
  }

  // =========================================================================
  // FEED OPERATIONS
  // =========================================================================

  async getFeedVideos(limit = 15): Promise<ServiceResponse<WolfpackVideo[]>> {
    try {
      const { data, error } = await supabase
        .from("wolfpack_videos")
        .select(`
          id,
          user_id,
          caption,
          video_url,
          thumbnail_url,
          like_count,
          comment_count,
          created_at,
          location_tag,
          is_active,
          users!user_id (
            id,
            display_name,
            username,
            first_name,
            last_name,
            avatar_url,
            location,
            wolfpack_status
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error("Error fetching feed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feed",
      };
    }
  }

  // =========================================================================
  // SOCIAL INTERACTIONS
  // =========================================================================

  async toggleLike(
    videoId: string,
    userId?: string,
  ): Promise<ServiceResponse<{ liked: boolean }>> {
    // If no userId provided, get from current user
    let actualUserId = userId;
    if (!actualUserId) {
      const auth = await this.requireAuth();
      if (!auth) {
        return {
          success: false,
          error: "Authentication required to like videos",
        };
      }

      const profile = await this.getCurrentUserProfile();
      if (!profile) {
        return {
          success: false,
          error: "User profile not found",
        };
      }
      actualUserId = profile.id;
    }

    try {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from("wolfpack_post_likes")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", actualUserId)
        .single();

      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from("wolfpack_post_likes")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", actualUserId);

        if (error) throw error;

        // Decrement like count
        await supabase.rpc("decrement_video_likes", { video_id: videoId });

        return { success: true, data: { liked: false } };
      } else {
        // Like
        const { error } = await supabase
          .from("wolfpack_post_likes")
          .insert({ video_id: videoId, user_id: actualUserId });

        if (error) throw error;

        // Increment like count
        await supabase.rpc("increment_video_likes", { video_id_param: videoId });

        // Send notification to video owner
        await this.notifyLike(videoId, actualUserId);

        return { success: true, data: { liked: true } };
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle like",
      };
    }
  }

  async toggleFollow(
    followingId: string,
    followerId?: string,
  ): Promise<ServiceResponse<{ following: boolean }>> {
    // If no followerId provided, get from current user
    let actualFollowerId = followerId;
    if (!actualFollowerId) {
      const auth = await this.requireAuth();
      if (!auth) {
        return {
          success: false,
          error: "Authentication required to follow users",
        };
      }

      const profile = await this.getCurrentUserProfile();
      if (!profile) {
        return {
          success: false,
          error: "User profile not found",
        };
      }
      actualFollowerId = profile.id;
    }

    try {
      // Check if already following
      const { data: existingFollow } = await supabase
        .from("wolfpack_follows")
        .select("id")
        .eq("follower_id", actualFollowerId)
        .eq("following_id", followingId)
        .single();

      if (existingFollow) {
        // Unfollow
        const { error } = await supabase
          .from("wolfpack_follows")
          .delete()
          .eq("follower_id", actualFollowerId)
          .eq("following_id", followingId);

        if (error) throw error;
        return { success: true, data: { following: false } };
      } else {
        // Follow
        const { error } = await supabase
          .from("wolfpack_follows")
          .insert({ follower_id: actualFollowerId, following_id: followingId });

        if (error) throw error;
        return { success: true, data: { following: true } };
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to toggle follow",
      };
    }
  }

  async trackShare(
    videoId: string,
    userId: string,
    platform: string,
  ): Promise<ServiceResponse> {
    try {
      // Track share action
      const { error } = await supabase
        .from("wolfpack_shares")
        .insert({
          video_id: videoId,
          user_id: userId,
          platform,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Error tracking share:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to track share",
      };
    }
  }

  // =========================================================================
  // USER SEARCH & DISCOVERY
  // =========================================================================

  async searchUsers(
    query: string,
    currentUserId: string,
    limit = 20,
  ): Promise<ServiceResponse<WolfpackUser[]>> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select(`
          id,
          display_name,
          username,
          first_name,
          last_name,
          avatar_url,
          location,
          wolfpack_status
        `)
        .neq("id", currentUserId)
        .or(
          `display_name.ilike.%${query}%,username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`,
        )
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error("Error searching users:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to search users",
      };
    }
  }

  async getSuggestedUsers(
    currentUserId: string,
    limit = 10,
  ): Promise<ServiceResponse<WolfpackUser[]>> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select(`
          id,
          display_name,
          username,
          first_name,
          last_name,
          avatar_url,
          location,
          wolfpack_status
        `)
        .neq("id", currentUserId)
        .or("location.eq.florida_state,state.eq.Florida")
        .eq("wolfpack_status", "active")
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error("Error getting suggested users:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to get suggested users",
      };
    }
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================

  async getComments(
    videoId: string,
  ): Promise<ServiceResponse<WolfpackComment[]>> {
    try {
      const { data, error } = await supabase
        .from("wolfpack_comments")
        .select(`
          id,
          user_id,
          video_id,
          parent_comment_id,
          content,
          created_at,
          updated_at,
          is_deleted,
          likes_count,
          users:user_id (
            id,
            display_name,
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq("video_id", videoId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Organize into tree structure
      const comments = this.organizeCommentsIntoTree(data || []);

      return {
        success: true,
        data: comments,
      };
    } catch (error) {
      console.error("Error getting comments:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to get comments",
      };
    }
  }

  private organizeCommentsIntoTree(comments: any[]): WolfpackComment[] {
    const commentMap = new Map();
    const rootComments: WolfpackComment[] = [];

    // First pass: create map of all comments
    comments.forEach((comment) => {
      commentMap.set(comment.id, {
        ...comment,
        replies: [],
        user: comment.users,
      });
    });

    // Second pass: organize into tree
    comments.forEach((comment) => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
          parent.replies_count = (parent.replies_count || 0) + 1;
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    return rootComments;
  }

  // =========================================================================
  // VIDEO MANAGEMENT
  // =========================================================================

  async deleteVideo(
    videoId: string,
    userId?: string,
  ): Promise<ServiceResponse> {
    // If no userId provided, get from current user
    let actualUserId = userId;
    if (!actualUserId) {
      const auth = await this.requireAuth();
      if (!auth) {
        return {
          success: false,
          error: "Authentication required to delete videos",
        };
      }

      const profile = await this.getCurrentUserProfile();
      if (!profile) {
        return {
          success: false,
          error: "User profile not found",
        };
      }
      actualUserId = profile.id;
    }

    try {
      const { error } = await supabase.rpc("delete_user_video", {
        video_id_param: videoId,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error deleting video:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to delete video",
      };
    }
  }

  // =========================================================================
  // FIREBASE PUSH NOTIFICATIONS - COMPREHENSIVE SYSTEM
  // =========================================================================

  async sendNotification(params: {
    userId: string;
    title: string;
    body: string;
    data?: any;
    type:
      | "dj_broadcast"
      | "message"
      | "like"
      | "comment"
      | "follow"
      | "event"
      | "admin";
  }): Promise<ServiceResponse> {
    try {
      // Get user's FCM token
      const { data: user } = await supabase
        .from("users")
        .select("fcm_token, notification_preferences")
        .eq("id", params.userId)
        .single();

      if (!user?.fcm_token) {
        return {
          success: false,
          error: "User has no FCM token",
        };
      }

      // Check if user has notifications enabled for this type
      const prefs = user.notification_preferences || {};
      const typeEnabled = this.checkNotificationPreference(params.type, prefs);

      if (!typeEnabled) {
        return {
          success: false,
          error: "User has disabled this notification type",
        };
      }

      // Send notification via API
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: user.fcm_token,
          title: params.title,
          body: params.body,
          data: {
            type: params.type,
            ...params.data,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send notification");
      }

      // Log notification in database
      await supabase
        .from("notifications")
        .insert({
          user_id: params.userId,
          title: params.title,
          body: params.body,
          type: params.type,
          data: params.data,
          sent_at: new Date().toISOString(),
        });

      return { success: true };
    } catch (error) {
      console.error("Error sending notification:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send notification",
      };
    }
  }

  private checkNotificationPreference(type: string, prefs: any): boolean {
    switch (type) {
      case "dj_broadcast":
        return prefs.events !== false;
      case "message":
        return prefs.chatMessages !== false;
      case "like":
      case "comment":
      case "follow":
        return prefs.socialInteractions !== false;
      case "event":
        return prefs.events !== false;
      case "admin":
        return prefs.announcements !== false;
      default:
        return true;
    }
  }

  // DJ Broadcast Notifications
  async notifyDJBroadcast(
    djId: string,
    eventTitle: string,
    eventData: any,
  ): Promise<ServiceResponse> {
    try {
      // Get all users who should be notified about DJ events
      const { data: users } = await supabase
        .from("users")
        .select("id, fcm_token, notification_preferences")
        .eq("wolfpack_status", "active")
        .not("fcm_token", "is", null);

      if (!users?.length) {
        return { success: true, data: { notified: 0 } };
      }

      let notified = 0;
      for (const user of users) {
        const result = await this.sendNotification({
          userId: user.id,
          title: "🎵 DJ Live Now!",
          body: `${eventTitle} - Tune in to the Wolf Pack!`,
          type: "dj_broadcast",
          data: {
            djId,
            eventId: eventData.id,
            action: "join_broadcast",
          },
        });

        if (result.success) notified++;
      }

      return { success: true, data: { notified } };
    } catch (error) {
      console.error("Error sending DJ broadcast notifications:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send DJ notifications",
      };
    }
  }

  // Message Notifications
  async notifyNewMessage(
    fromUserId: string,
    toUserId: string,
    message: string,
  ): Promise<ServiceResponse> {
    try {
      const { data: fromUser } = await supabase
        .from("users")
        .select("display_name, username, first_name, last_name")
        .eq("id", fromUserId)
        .single();

      const senderName = this.getDisplayName(fromUser || {} as WolfpackUser);

      return await this.sendNotification({
        userId: toUserId,
        title: `💬 New message from ${senderName}`,
        body: message.length > 50 ? message.substring(0, 50) + "..." : message,
        type: "message",
        data: {
          fromUserId,
          action: "open_message",
        },
      });
    } catch (error) {
      console.error("Error sending message notification:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send message notification",
      };
    }
  }

  // Social Interaction Notifications
  async notifyLike(
    videoId: string,
    likerUserId: string,
  ): Promise<ServiceResponse> {
    try {
      // Get video owner
      const { data: video } = await supabase
        .from("wolfpack_videos")
        .select("user_id, caption")
        .eq("id", videoId)
        .single();

      if (!video || video.user_id === likerUserId) {
        return { success: true }; // Don't notify self-likes
      }

      const { data: liker } = await supabase
        .from("users")
        .select("display_name, username, first_name, last_name")
        .eq("id", likerUserId)
        .single();

      const likerName = this.getDisplayName(liker || {} as WolfpackUser);

      return await this.sendNotification({
        userId: video.user_id,
        title: "❤️ Someone liked your video!",
        body: `${likerName} liked your post`,
        type: "like",
        data: {
          videoId,
          likerUserId,
          action: "open_video",
        },
      });
    } catch (error) {
      console.error("Error sending like notification:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send like notification",
      };
    }
  }

  async notifyComment(
    videoId: string,
    commenterUserId: string,
    comment: string,
  ): Promise<ServiceResponse> {
    try {
      // Get video owner
      const { data: video } = await supabase
        .from("wolfpack_videos")
        .select("user_id, caption")
        .eq("id", videoId)
        .single();

      if (!video || video.user_id === commenterUserId) {
        return { success: true }; // Don't notify self-comments
      }

      const { data: commenter } = await supabase
        .from("users")
        .select("display_name, username, first_name, last_name")
        .eq("id", commenterUserId)
        .single();

      const commenterName = this.getDisplayName(
        commenter || {} as WolfpackUser,
      );

      return await this.sendNotification({
        userId: video.user_id,
        title: "💬 New comment on your video!",
        body: `${commenterName}: ${
          comment.length > 50 ? comment.substring(0, 50) + "..." : comment
        }`,
        type: "comment",
        data: {
          videoId,
          commenterUserId,
          action: "open_comments",
        },
      });
    } catch (error) {
      console.error("Error sending comment notification:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send comment notification",
      };
    }
  }

  async notifyFollow(
    followerId: string,
    followingId: string,
  ): Promise<ServiceResponse> {
    try {
      const { data: follower } = await supabase
        .from("users")
        .select("display_name, username, first_name, last_name")
        .eq("id", followerId)
        .single();

      const followerName = this.getDisplayName(follower || {} as WolfpackUser);

      return await this.sendNotification({
        userId: followingId,
        title: "🐺 New follower!",
        body: `${followerName} started following you`,
        type: "follow",
        data: {
          followerId,
          action: "open_profile",
        },
      });
    } catch (error) {
      console.error("Error sending follow notification:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send follow notification",
      };
    }
  }

  // Admin Notifications
  async notifyAllUsers(
    title: string,
    body: string,
    data?: any,
  ): Promise<ServiceResponse> {
    try {
      const { data: users } = await supabase
        .from("users")
        .select("id")
        .not("fcm_token", "is", null);

      if (!users?.length) {
        return { success: true, data: { notified: 0 } };
      }

      let notified = 0;
      for (const user of users) {
        const result = await this.sendNotification({
          userId: user.id,
          title,
          body,
          type: "admin",
          data,
        });

        if (result.success) notified++;
      }

      return { success: true, data: { notified } };
    } catch (error) {
      console.error("Error sending admin notifications:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Failed to send admin notifications",
      };
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  getDisplayName(user: WolfpackUser): string {
    return user.display_name ||
      `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      user.username ||
      "Anonymous";
  }

  getAvatarUrl(user: WolfpackUser): string {
    return user.avatar_url || "/icons/wolf-icon.png";
  }
}

// =============================================================================
// EXPORT SINGLETON INSTANCE
// =============================================================================

export const wolfpackService = UnifiedWolfpackService.getInstance();
export default wolfpackService;

// Export the class for testing if needed
export { UnifiedWolfpackService };
