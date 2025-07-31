import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const otherUserId = params.userId;

    // Get messages between current user and the other user
    const { data: messages, error } = await supabase
      .from('wolfpack_messages')
      .select(`
        id,
        sender_id,
        receiver_id,
        content,
        created_at,
        read
      `)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Mark messages as read
    await supabase
      .from('wolfpack_messages')
      .update({ read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', otherUserId)
      .eq('read', false);

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error('Error in messages conversation API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}