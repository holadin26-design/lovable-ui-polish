import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get pending followups scheduled for now or earlier
    const { data: followups, error: fErr } = await supabase
      .from("followups")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fErr) throw fErr;
    if (!followups || followups.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending followups" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const followup of followups) {
      try {
        // Check suppression list
        const { data: suppressed } = await supabase
          .from("suppressions")
          .select("id")
          .eq("email", followup.recipient_email)
          .maybeSingle();

        if (suppressed) {
          await supabase.from("followups").update({ status: "cancelled" }).eq("id", followup.id);
          continue;
        }

        // Get email account
        let emailAccount;
        if (followup.email_account_id) {
          const { data } = await supabase
            .from("email_accounts")
            .select("*")
            .eq("id", followup.email_account_id)
            .single();
          emailAccount = data;
        } else {
          // Get user's primary email account
          const { data } = await supabase
            .from("email_accounts")
            .select("*")
            .eq("user_id", followup.user_id)
            .eq("is_primary", true)
            .single();
          emailAccount = data;
        }

        if (!emailAccount) {
          await supabase.from("followups").update({
            status: "failed",
            bounce_reason: "No email account configured",
          }).eq("id", followup.id);
          failed++;
          continue;
        }

        // Check daily send limit
        if (emailAccount.sends_today >= emailAccount.daily_send_limit) {
          continue; // Skip, will retry next cycle
        }

        // Resolve lead data for variable substitution
        let body = followup.body;
        let subject = followup.subject;

        if (followup.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("*")
            .eq("id", followup.lead_id)
            .single();

          if (lead) {
            const vars: Record<string, string> = {
              name: lead.name || "",
              company: lead.company || "",
              email: lead.email || "",
              personalized_line: lead.ai_personalized_line || "",
            };

            // Add custom fields
            if (lead.custom_fields && typeof lead.custom_fields === "object") {
              for (const [k, v] of Object.entries(lead.custom_fields as Record<string, string>)) {
                vars[k] = v || "";
              }
            }

            for (const [key, value] of Object.entries(vars)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
              body = body.replace(regex, value);
              subject = subject.replace(regex, value);
            }
          }
        }

        // Inject tracking pixel and wrap links
        const trackBaseUrl = `${supabaseUrl}/functions/v1/track`;
        const trackingPixel = `<img src="${trackBaseUrl}?type=open&fid=${followup.id}" width="1" height="1" style="display:none" />`;

        // Wrap links for click tracking
        body = body.replace(
          /href="(https?:\/\/[^"]+)"/gi,
          (_, url) => `href="${trackBaseUrl}?type=click&fid=${followup.id}&url=${encodeURIComponent(url)}"`
        );

        // Add unsubscribe link
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?fid=${followup.id}&email=${encodeURIComponent(followup.recipient_email)}`;
        const footer = `<br/><p style="font-size:11px;color:#999;margin-top:20px;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>`;

        const htmlBody = body.replace(/\n/g, "<br/>") + footer + trackingPixel;

        // Send via SMTP
        const messageId = `<${crypto.randomUUID()}@${emailAccount.email.split("@")[1]}>`;

        const emailContent = [
          `From: ${emailAccount.display_name ? `"${emailAccount.display_name}" <${emailAccount.email}>` : emailAccount.email}`,
          `To: ${followup.recipient_email}`,
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `List-Unsubscribe: <${unsubscribeUrl}>`,
          `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          htmlBody,
        ].join("\r\n");

        await sendSmtp(emailAccount, followup.recipient_email, emailContent);

        // Update followup
        await supabase.from("followups").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: messageId,
        }).eq("id", followup.id);

        // Increment sends_today
        await supabase.from("email_accounts").update({
          sends_today: emailAccount.sends_today + 1,
        }).eq("id", emailAccount.id);

        processed++;

        // Random delay between 5-30 seconds
        const delay = Math.floor(Math.random() * 25000) + 5000;
        await new Promise((r) => setTimeout(r, delay));
      } catch (sendErr: any) {
        console.error(`Failed to send followup ${followup.id}:`, sendErr.message);
        await supabase.from("followups").update({
          status: "failed",
          bounce_reason: sendErr.message?.slice(0, 500),
        }).eq("id", followup.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: followups.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Send email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// SMTP sending via Deno TCP
async function sendSmtp(account: any, to: string, emailContent: string) {
  const isSSL = account.smtp_port === 465;
  let conn: Deno.Conn;

  if (isSSL) {
    conn = await Deno.connectTls({ hostname: account.smtp_host, port: account.smtp_port });
  } else {
    conn = await Deno.connect({ hostname: account.smtp_host, port: account.smtp_port });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function readResponse(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    if (n === null) throw new Error("Connection closed");
    return decoder.decode(buf.subarray(0, n));
  }

  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + "\r\n"));
    return await readResponse();
  }

  try {
    // Read greeting
    await readResponse();

    // EHLO
    let ehloResp = await sendCommand(`EHLO localhost`);

    // STARTTLS for port 587
    if (!isSSL && ehloResp.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
      ehloResp = await sendCommand(`EHLO localhost`);
    }

    // AUTH LOGIN
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(account.email));
    const authResp = await sendCommand(btoa(account.app_password));
    if (!authResp.startsWith("235")) {
      throw new Error(`Auth failed: ${authResp}`);
    }

    // MAIL FROM
    await sendCommand(`MAIL FROM:<${account.email}>`);

    // RCPT TO
    const rcptResp = await sendCommand(`RCPT TO:<${to}>`);
    if (rcptResp.startsWith("5")) {
      throw new Error(`Recipient rejected: ${rcptResp}`);
    }

    // DATA
    await sendCommand("DATA");
    await conn.write(encoder.encode(emailContent + "\r\n.\r\n"));
    const dataResp = await readResponse();
    if (!dataResp.startsWith("250")) {
      throw new Error(`Send failed: ${dataResp}`);
    }

    await sendCommand("QUIT");
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}
