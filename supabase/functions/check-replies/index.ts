import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all email accounts that have active campaigns
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("*");

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ checked: 0, replies: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalReplies = 0;

    for (const account of accounts) {
      try {
        // Get sent followups with message_ids for this account
        const { data: sentFollowups } = await supabase
          .from("followups")
          .select("id, message_id, lead_id, user_id")
          .eq("status", "sent")
          .not("message_id", "is", null);

        if (!sentFollowups || sentFollowups.length === 0) continue;

        const messageIdMap = new Map<string, any>();
        for (const f of sentFollowups) {
          if (f.message_id) messageIdMap.set(f.message_id, f);
        }

        // Connect to IMAP
        const replies = await checkImapReplies(account, messageIdMap);

        for (const reply of replies) {
          // Update followup status
          await supabase.from("followups").update({ status: "replied" }).eq("id", reply.followup_id);

          // Update lead status if linked
          if (reply.lead_id) {
            await supabase.from("leads").update({ status: "replied" }).eq("id", reply.lead_id);
          }

          // Insert tracking event
          await supabase.from("tracking_events").insert({
            followup_id: reply.followup_id,
            user_id: reply.user_id,
            event_type: "reply",
          });

          totalReplies++;
        }
      } catch (accErr: any) {
        console.error(`IMAP error for ${account.email}:`, accErr.message);
      }
    }

    return new Response(
      JSON.stringify({ checked: accounts.length, replies: totalReplies }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Check replies error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkImapReplies(
  account: any,
  messageIdMap: Map<string, any>
): Promise<Array<{ followup_id: string; lead_id: string | null; user_id: string }>> {
  const replies: Array<{ followup_id: string; lead_id: string | null; user_id: string }> = [];

  try {
    const conn = await Deno.connectTls({
      hostname: account.imap_host,
      port: account.imap_port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readLine(): Promise<string> {
      const buf = new Uint8Array(8192);
      const n = await conn.read(buf);
      if (n === null) throw new Error("Connection closed");
      return decoder.decode(buf.subarray(0, n));
    }

    async function sendCmd(tag: string, cmd: string): Promise<string> {
      await conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
      let response = "";
      while (true) {
        const line = await readLine();
        response += line;
        if (line.includes(`${tag} OK`) || line.includes(`${tag} NO`) || line.includes(`${tag} BAD`)) break;
      }
      return response;
    }

    // Read greeting
    await readLine();

    // Login
    const loginResp = await sendCmd("A1", `LOGIN "${account.email}" "${account.app_password}"`);
    if (loginResp.includes("A1 NO") || loginResp.includes("A1 BAD")) {
      throw new Error("IMAP login failed");
    }

    // Select INBOX
    await sendCmd("A2", "SELECT INBOX");

    // Search for recent unseen messages (last 3 days)
    const searchResp = await sendCmd("A3", "SEARCH UNSEEN SINCE " + getImapDate(3));
    const uidMatch = searchResp.match(/\* SEARCH ([\d\s]+)/);

    if (uidMatch) {
      const uids = uidMatch[1].trim().split(/\s+/).slice(0, 100); // Limit to 100

      for (const uid of uids) {
        try {
          const fetchResp = await sendCmd("A4", `FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (In-Reply-To References)])`);

          // Extract In-Reply-To and References headers
          const inReplyTo = fetchResp.match(/In-Reply-To:\s*(<[^>]+>)/i)?.[1];
          const references = fetchResp.match(/References:\s*(.+)/i)?.[1];

          const allRefs = [inReplyTo, ...(references?.split(/\s+/) || [])].filter(Boolean);

          for (const ref of allRefs) {
            if (ref && messageIdMap.has(ref)) {
              const followup = messageIdMap.get(ref);
              replies.push({
                followup_id: followup.id,
                lead_id: followup.lead_id,
                user_id: followup.user_id,
              });
              break;
            }
          }
        } catch { /* skip individual message errors */ }
      }
    }

    await sendCmd("A5", "LOGOUT");
    try { conn.close(); } catch { /* ignore */ }
  } catch (err: any) {
    console.error(`IMAP check failed for ${account.email}:`, err.message);
  }

  return replies;
}

function getImapDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}
