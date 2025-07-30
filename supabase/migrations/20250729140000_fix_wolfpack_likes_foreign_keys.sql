-- Fix wolfpack_likes table foreign key references
-- The original table referenced auth.users but we need to reference our users table

-- First drop the existing table if it exists
DROP TABLE IF EXISTS wolfpack_likes CASCADE;

-- Recreate with correct foreign key references
CREATE TABLE wolfpack_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES wolfpack_videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, video_id) -- Prevent duplicate likes
);

-- Create indexes for performance
CREATE INDEX idx_wolfpack_likes_video_id ON wolfpack_likes(video_id);
CREATE INDEX idx_wolfpack_likes_user_id ON wolfpack_likes(user_id);

-- Enable Row Level Security
ALTER TABLE wolfpack_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for likes
CREATE POLICY "Users can view all likes" ON wolfpack_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own likes" ON wolfpack_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON wolfpack_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON TABLE wolfpack_likes TO anon;
GRANT SELECT, INSERT, DELETE ON TABLE wolfpack_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE wolfpack_likes TO service_role;