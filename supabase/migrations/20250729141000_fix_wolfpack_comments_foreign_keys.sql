-- Fix wolfpack_commentstable foreign key references
-- The original table referenced auth.users but we need to make sure it's consistent

-- First drop the existing table if it exists
DROP TABLE IF EXISTS wolfpack_commentsCASCADE;

-- Recreate wolfpack_comments table with correct foreign key references
CREATE TABLE wolfpack_comments(
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES wolfpack_videos(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES wolfpack_comments(id) ON DELETE CASCADE, -- For nested wolfpack_comments
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE -- Soft delete for moderation
);

-- Create indexes for performance
CREATE INDEX idx_wolfpack_comments_video_id ON wolfpack_comments(video_id);
CREATE INDEX idx_wolfpack_comments_user_id ON wolfpack_comments(user_id);
CREATE INDEX idx_wolfpack_comments_parent_id ON wolfpack_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_wolfpack_comments_created_at ON wolfpack_comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE wolfpack_commentsENABLE ROW LEVEL SECURITY;

-- RLS Policies for wolfpack_comments
CREATE POLICY "Users can view all non-deleted wolfpack_comments" ON wolfpack_comments
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Users can create wolfpack_comments" ON wolfpack_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT is_deleted);

CREATE POLICY "Users can update their own wolfpack_comments" ON wolfpack_comments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
GRANT SELECT, INSERT, UPDATE ON TABLE wolfpack_commentsTO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE wolfpack_commentsTO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wolfpack_commentsTO service_role;