const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zdybrtqcvgrewprewfbw.supabase.co';
const supabaseKey = 'sb_publishable_uscWSFx0T1fInp-hyR0ZKw_gKmSMzu0';

const client1 = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const apprentiEmail = 'test_apprenti@gmail.com';
const password = 'Password123!';

async function main() {
  try {
    const { data: aAuth } = await client1.auth.signInWithPassword({ email: apprentiEmail, password });
    const apprentiId = aAuth.user.id;

    console.log("Logged in as apprentice:", apprentiId);

    // Try inserting a fake subscription
    const fakeSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint-xyz",
      keys: {
        p256dh: "fake-p256dh-key",
        auth: "fake-auth-key"
      }
    };

    console.log("Inserting fake subscription...");
    const { data: insertData, error: insertError } = await client1
      .from('user_push_subscriptions')
      .insert({
        user_id: apprentiId,
        subscription: fakeSub
      })
      .select();

    if (insertError) {
      console.error("Insert failed:", insertError);
    } else {
      console.log("Insert succeeded! Inserted rows:", insertData);
    }

    // Try reading it back via direct SELECT
    console.log("Reading back direct SELECT...");
    const { data: selectData, error: selectError } = await client1
      .from('user_push_subscriptions')
      .select('*');
    if (selectError) {
      console.error("Select failed:", selectError);
    } else {
      console.log("Select returned:", selectData);
    }

    // Try invoking the RPC function get_user_subscriptions
    console.log("Invoking get_user_subscriptions RPC...");
    const { data: rpcData, error: rpcError } = await client1.rpc('get_user_subscriptions', {
      target_user_id: apprentiId
    });
    if (rpcError) {
      console.error("RPC failed:", rpcError);
    } else {
      console.log("RPC returned:", rpcData);
    }

  } catch (err) {
    console.error("Test failed:", err);
  }
}

main();
