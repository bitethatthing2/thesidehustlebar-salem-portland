-- Final correct implementation for wolfpack likes and wolfpack_comments
-- This restores the proper foreign key relationships to public.users
-- and includes correct RLS policies with proper auth mapping

-- Drop any incorrectly created tables
DROP TABLE IF EXISTS wolfpack_likes CASCADE;
DROP TABLE IF EXISTS wolfpack_comments CASCADE;
DROP TABLE IF EXISTS wolfpack_comments CASCADE;

-- Create wolfpack_post_likes table (following existing naming convention)
CREATE TABLE wolfpack_post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES wolfpack_videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, video_id)
);

-- Create wolfpack_comments table
CREATE TABLE wolfpack_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES wolfpack_videos(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES wolfpack_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX idx_wolfpack_post_likes_video_id ON wolfpack_post_likes(video_id);
CREATE INDEX idx_wolfpack_post_likes_user_id ON wolfpack_post_likes(user_id);
CREATE INDEX idx_wolfpack_comments_video_id ON wolfpack_comments(video_id);
CREATE INDEX idx_wolfpack_comments_user_id ON wolfpack_comments(user_id);
CREATE INDEX idx_wolfpack_comments_parent_id ON wolfpack_comments(parent_id) WHERE parent_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE wolfpack_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wolfpack_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wolfpack_post_likes
CREATE POLICY "Anyone can view likes" ON wolfpack_post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON wolfpack_post_likes
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove own likes" ON wolfpack_post_likes
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- RLS Policies for wolfpack_comments
CREATE POLICY "Anyone can view non-deleted wolfpack_comments" ON wolfpack_comments
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Users can add wolfpack_comments" ON wolfpack_comments
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit own wolfpack_comments" ON wolfpack_comments
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  ) WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- Update trigger for wolfpack_comments updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wolfpack_comments_updated_at
  BEFORE UPDATE ON wolfpack_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON TABLE wolfpack_post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON TABLE wolfpack_post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wolfpack_post_likes TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE wolfpack_comments TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE wolfpack_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wolfpack_comments TO service_role;