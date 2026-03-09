import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  if (req.method === "GET") {
    const email = url.searchParams.get("email") || "";
    const fid = url.searchParams.get("fid") || "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
  .card{background:#fff;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#6b7280;font-size:14px;margin:0 0 24px}
  button{background:#ef4444;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer}
  button:hover{background:#dc2626}
  .done{color:#10b981;font-weight:600}
</style>
</head><body>
<div class="card" id="card">
  <h1>Unsubscribe</h1>
  <p>Click below to unsubscribe <strong>${email}</strong> from future emails.</p>
  <button onclick="doUnsub()">Unsubscribe</button>
</div>
<script>
async function doUnsub(){
  try{
    const r=await fetch(window.location.origin+window.location.pathname,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({followup_id:'${fid}',email:'${email}'})
    });
    if(r.ok){
      document.getElementById('card').innerHTML='<h1 class="done">✓ Unsubscribed</h1><p>You won\\'t receive any more emails from us.</p>';
    }else{
      alert('Something went wrong. Please try again.');
    }
  }catch(e){alert('Error: '+e.message)}
}
</script>
</body></html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (req.method === "POST") {
    try {
      const { followup_id, email } = await req.json();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), { status: 400 });
      }

      // Get followup to find user_id
      let userId: string | null = null;
      if (followup_id) {
        const { data: followup } = await supabase
          .from("followups")
          .select("user_id")
          .eq("id", followup_id)
          .single();
        userId = followup?.user_id || null;
      }

      if (!userId) {
        // Try to find from any followup with this email
        const { data: anyFollowup } = await supabase
          .from("followups")
          .select("user_id")
          .eq("recipient_email", email)
          .limit(1)
          .single();
        userId = anyFollowup?.user_id || null;
      }

      if (userId) {
        // Add to suppressions
        await supabase.from("suppressions").upsert(
          { email, user_id: userId, reason: "unsubscribed" },
          { onConflict: "email,user_id" }
        );

        // Cancel all pending followups for this email
        await supabase
          .from("followups")
          .update({ status: "cancelled" })
          .eq("recipient_email", email)
          .eq("status", "pending");

        // Insert tracking event
        if (followup_id) {
          await supabase.from("tracking_events").insert({
            followup_id,
            user_id: userId,
            event_type: "unsubscribe",
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
