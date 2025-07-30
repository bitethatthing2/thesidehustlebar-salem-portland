-- Enable RLS on wolfpack_videos table
ALTER TABLE wolfpack_videos ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own videos
CREATE POLICY "Users can insert their own videos" ON wolfpack_videos
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view all videos
CREATE POLICY "Users can view all videos" ON wolfpack_videos
FOR SELECT TO authenticated
USING (true);

-- Allow users to update their own videos
CREATE POLICY "Users can update their own videos" ON wolfpack_videos
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);