// Fixed Like Service
export class LikeService {
  constructor(private supabase: any) {}

  /**
   * Toggle like on a video - handles user ID conversion properly
   */
  async toggleLike(videoId: string) {
    try {
      // Get current user's public ID
      const { data: { user: authUser } } = await this.supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data: publicUser } = await this.supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (!publicUser) throw new Error('User profile not found');

      // Check if already liked
      const { data: existingLike } = await this.supabase
        .from('wolfpack_post_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', publicUser.id)
        .single();

      if (existingLike) {
        // Unlike
        const { error } = await this.supabase
          .from('wolfpack_post_likes')
          .delete()
          .eq('id', existingLike.id);

        if (error) throw error;
        return { liked: false };
      } else {
        // Like - the trigger will handle notifications
        const { error } = await this.supabase
          .from('wolfpack_post_likes')
          .insert({
            video_id: videoId,
            user_id: publicUser.id // Use public user ID
          });

        if (error) throw error;
        return { liked: true };
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  /**
   * Get like status for a video
   */
  async getLikeStatus(videoId: string) {
    try {
      const { data: { user: authUser } } = await this.supabase.auth.getUser();
      if (!authUser) return { liked: false, count: 0 };

      const { data: publicUser } = await this.supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (!publicUser) return { liked: false, count: 0 };

      // Check if user has liked
      const { data: userLike } = await this.supabase
        .from('wolfpack_post_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', publicUser.id)
        .single();

      // Get total like count
      const { count } = await this.supabase
        .from('wolfpack_post_likes')
        .select('*', { count: 'exact' })
        .eq('video_id', videoId);

      return {
        liked: !!userLike,
        count: count || 0
      };
    } catch (error) {
      console.error('Error getting like status:', error);
      return { liked: false, count: 0 };
    }
  }
}