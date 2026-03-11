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
    const { emails, userId, delayMs } = await req.json();
    // emails: Array<{ recipientEmail, subject, body, emailAccountId, leadId? }>

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: "No emails to send" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache email accounts to avoid repeated lookups
    const accountCache: Record<string, any> = {};

    const results: any[] = [];
    const delay = Math.max(delayMs || 2000, 500);

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        // Check suppression
        const { data: suppressed } = await supabase
          .from("suppressions")
          .select("id")
          .eq("email", email.recipientEmail)
          .maybeSingle();

        if (suppressed) {
          results.push({ email: email.recipientEmail, ok: false, note: "Suppressed" });
          continue;
        }

        // Get email account (cached)
        if (!accountCache[email.emailAccountId]) {
          const { data } = await supabase
            .from("email_accounts")
            .select("*")
            .eq("id", email.emailAccountId)
            .single();
          accountCache[email.emailAccountId] = data;
        }
        const emailAccount = accountCache[email.emailAccountId];

        if (!emailAccount) {
          results.push({ email: email.recipientEmail, ok: false, note: "No email account" });
          continue;
        }

        // Check daily send limit
        if (emailAccount.sends_today >= emailAccount.daily_send_limit) {
          results.push({ email: email.recipientEmail, ok: false, note: "Daily limit reached" });
          continue;
        }

        // Inject tracking pixel + unsubscribe
        let htmlBody = email.body.replace(/\n/g, "<br/>");
        const trackBaseUrl = `${supabaseUrl}/functions/v1/track`;

        // Create followup record first to get ID for tracking
        const { data: followup, error: fErr } = await supabase
          .from("followups")
          .insert({
            user_id: userId,
            recipient_email: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            scheduled_for: new Date().toISOString(),
            status: "pending",
            email_account_id: email.emailAccountId,
            lead_id: email.leadId || null,
          })
          .select("id")
          .single();

        if (fErr) throw fErr;
        const fid = followup!.id;

        // Tracking pixel
        const trackingPixel = `<img src="${trackBaseUrl}?type=open&fid=${fid}" width="1" height="1" style="display:none" />`;

        // Wrap links for click tracking
        htmlBody = htmlBody.replace(
          /href="(https?:\/\/[^"]+)"/gi,
          (_, url) => `href="${trackBaseUrl}?type=click&fid=${fid}&url=${encodeURIComponent(url)}"`
        );

        // Unsubscribe
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?fid=${fid}&email=${encodeURIComponent(email.recipientEmail)}`;
        const footer = `<br/><p style="font-size:11px;color:#999;margin-top:20px;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>`;

        htmlBody = htmlBody + footer + trackingPixel;

        // Build email content
        const messageId = `<${crypto.randomUUID()}@${emailAccount.email.split("@")[1]}>`;
        const emailContent = [
          `From: ${emailAccount.display_name ? `"${emailAccount.display_name}" <${emailAccount.email}>` : emailAccount.email}`,
          `To: ${email.recipientEmail}`,
          `Subject: ${email.subject}`,
          `Message-ID: ${messageId}`,
          `List-Unsubscribe: <${unsubscribeUrl}>`,
          `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          htmlBody,
        ].join("\r\n");

        // Send via SMTP
        await sendSmtp(emailAccount, email.recipientEmail, emailContent);

        // Update followup to sent
        await supabase.from("followups").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: messageId,
        }).eq("id", fid);

        // Increment sends_today
        await supabase.from("email_accounts").update({
          sends_today: emailAccount.sends_today + 1,
        }).eq("id", emailAccount.id);
        emailAccount.sends_today++;

        results.push({ email: email.recipientEmail, ok: true, note: `Sent via ${emailAccount.email}` });

        // Delay between sends
        if (i < emails.length - 1) {
          const jitter = Math.floor(Math.random() * 2000);
          await new Promise((r) => setTimeout(r, delay + jitter));
        }
      } catch (sendErr: any) {
        console.error(`Failed to send to ${email.recipientEmail}:`, sendErr.message);

        // Try to mark followup as failed if we created one
        results.push({ email: email.recipientEmail, ok: false, note: sendErr.message?.slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ results, total: emails.length, sent: results.filter(r => r.ok).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Bulk send error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── SMTP sending (same as send-email function) ──
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
    await readResponse();
    let ehloResp = await sendCommand("EHLO localhost");
    if (!isSSL && ehloResp.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
      ehloResp = await sendCommand("EHLO localhost");
    }

    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(account.email));
    const authResp = await sendCommand(btoa(account.app_password));
    if (!authResp.startsWith("235")) throw new Error(`Auth failed: ${authResp}`);

    await sendCommand(`MAIL FROM:<${account.email}>`);
    const rcptResp = await sendCommand(`RCPT TO:<${to}>`);
    if (rcptResp.startsWith("5")) throw new Error(`Recipient rejected: ${rcptResp}`);

    await sendCommand("DATA");
    await conn.write(encoder.encode(emailContent + "\r\n.\r\n"));
    const dataResp = await readResponse();
    if (!dataResp.startsWith("250")) throw new Error(`Send failed: ${dataResp}`);

    await sendCommand("QUIT");
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}
