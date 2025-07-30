-- Fix foreign key constraint in wolfpack_post_likes
-- The constraint should reference wolfpack_videos, not wolfpack_videos

-- First, drop the existing incorrect constraint
ALTER TABLE wolfpack_post_likes 
DROP CONSTRAINT wolfpack_video_likes_video_id_fkey;

-- Add the correct constraint pointing to wolfpack_videos
ALTER TABLE wolfpack_post_likes 
ADD CONSTRAINT wolfpack_post_likes_video_id_fkey 
FOREIGN KEY (video_id) REFERENCES wolfpack_videos(id) ON DELETE CASCADE;

-- Verify the constraint is correct
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='wolfpack_post_likes';