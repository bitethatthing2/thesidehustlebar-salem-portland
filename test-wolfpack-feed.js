const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://tvnpgbjypnezoasbhbwx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2bnBnYmp5cG5lem9hc2JoYnd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzOTM0MDMsImV4cCI6MjA2Mzk2OTQwM30.5u3YkO5BvdJ3eabOzNhEuKDF2IvugTFE_EAvB-V7Y9c';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWolfpackFeed() {
  console.log('\n=== Testing Wolfpack Feed ===\n');

  try {
    // 1. Test direct table query
    console.log('1. Testing direct wolfpack_videos table query:');
    const { data: videos, error: videosError } = await supabase
      .from('wolfpack_videos')
      .select('*')
      .eq('is_active', true)
      .limit(5);

    if (videosError) {
      console.error('Error querying wolfpack_videos:', videosError);
    } else {
      console.log(`Found ${videos?.length || 0} videos in wolfpack_videos table`);
      if (videos?.length > 0) {
        console.log('Sample video:', {
          id: videos[0].id,
          caption: videos[0].caption,
          video_url: videos[0].video_url ? 'URL present' : 'No URL',
          created_at: videos[0].created_at
        });
      }
    }

    // 2. Test get_wolfpack_feed_simple function
    console.log('\n2. Testing get_wolfpack_feed_simple function:');
    const { data: simpleFeed, error: simpleFeedError } = await supabase
      .rpc('get_wolfpack_feed_simple', {
        limit_count: 5,
        offset_count: 0
      });

    if (simpleFeedError) {
      console.error('Error calling get_wolfpack_feed_simple:', simpleFeedError);
    } else {
      console.log(`Got ${simpleFeed?.length || 0} items from get_wolfpack_feed_simple`);
      if (simpleFeed?.length > 0) {
        console.log('Sample feed item:', {
          id: simpleFeed[0].id,
          caption: simpleFeed[0].caption,
          username: simpleFeed[0].username,
          likes_count: simpleFeed[0].likes_count
        });
      }
    }

    // 3. Test with user join
    console.log('\n3. Testing wolfpack_videos with user join:');
    const { data: videosWithUser, error: joinError } = await supabase
      .from('wolfpack_videos')
      .select(`
        *,
        user:users!user_id(
          id,
          username,
          display_name,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('is_active', true)
      .limit(5);

    if (joinError) {
      console.error('Error querying with user join:', joinError);
    } else {
      console.log(`Found ${videosWithUser?.length || 0} videos with user data`);
      if (videosWithUser?.length > 0) {
        console.log('Sample video with user:', {
          id: videosWithUser[0].id,
          caption: videosWithUser[0].caption,
          user: videosWithUser[0].user ? {
            username: videosWithUser[0].user.username,
            display_name: videosWithUser[0].user.display_name
          } : 'No user data'
        });
      }
    }

    // 4. Test edge function
    console.log('\n4. Testing wolfpack-feed edge function:');
    try {
      const response = await fetch('https://tvnpgbjypnezoasbhbwx.supabase.co/functions/v1/wolfpack-feed?limit=5', {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      const edgeFunctionData = await response.json();
      
      if (edgeFunctionData.success) {
        console.log(`Edge function returned ${edgeFunctionData.data?.length || 0} items`);
        console.log('Total items available:', edgeFunctionData.pagination?.total);
      } else {
        console.error('Edge function error:', edgeFunctionData.error);
      }
    } catch (fetchError) {
      console.error('Error calling edge function:', fetchError);
    }

    // 5. Check RLS policies
    console.log('\n5. Checking RLS policies:');
    const { data: rlsCheck, error: rlsError } = await supabase
      .from('wolfpack_videos')
      .select('id')
      .limit(1);

    if (rlsError) {
      console.error('RLS policy error:', rlsError);
    } else {
      console.log('RLS policies allow read access ✓');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the tests
testWolfpackFeed().then(() => {
  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});