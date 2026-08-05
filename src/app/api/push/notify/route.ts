import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@phorge.fr';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: NextRequest) {
  try {
    const { userId, title, body, url } = await request.json();
    console.log(`[API /api/push/notify] POST received for userId: "${userId}"`);

    if (!userId || !title || !body) {
      console.warn('[API /api/push/notify] Missing required parameters');
      return NextResponse.json({ error: 'Parameters userId, title, and body are required' }, { status: 400 });
    }

    // Call postgres function to bypass RLS for fetching user's subscriptions
    const { data: subscriptions, error } = await supabase.rpc('get_user_subscriptions', {
      target_user_id: userId,
    });

    if (error) {
      console.error('[API /api/push/notify] get_user_subscriptions RPC error:', error);
      return NextResponse.json({ error: 'Failed to fetch user subscriptions' }, { status: 500 });
    }

    console.log(`[API /api/push/notify] Found ${subscriptions?.length || 0} subscriptions for user "${userId}"`);
    if (subscriptions && subscriptions.length > 0) {
      console.log(`[API /api/push/notify] First subscription endpoint:`, subscriptions[0].subscription?.endpoint);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found for this user' });
    }

    const payload = JSON.stringify({ title, body, url: url || '/messages' });
    let sentCount = 0;

    const promises = subscriptions.map(async (subRecord: any) => {
      try {
        await webpush.sendNotification(subRecord.subscription, payload);
        sentCount++;
      } catch (err: any) {
        // Handle expired or gone subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Pruning expired push subscription ${subRecord.id}`);
          await supabase.rpc('delete_push_subscription', { sub_id: subRecord.id });
        } else {
          console.error(`Error sending to push subscription ${subRecord.id}:`, err);
        }
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err: any) {
    console.error('Web Push delivery error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
