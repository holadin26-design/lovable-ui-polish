import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ════════════════════════════════════════════════════════════════════════════════
// Ported from https://github.com/Infignity/MagicpitchWarmup
// scheduler/actions/warmup.py → periodic_warmup()
// scheduler/actions/mail.py → send_warmup_emails() / send_single_mail()
// ════════════════════════════════════════════════════════════════════════════════

function xOfY(x: number, y: number): number {
  return Math.round(x * y);
}

function generateBatchId(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ── SMTP sending (ported from mail.py send_single_mail) ──
async function sendSmtp(account: any, toEmail: string, subject: string, body: string, batchId: string) {
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
    await readResponse(); // greeting

    let ehloResp = await sendCommand("EHLO localhost");

    // STARTTLS for port 587 (ported from mail.py security == "tls")
    if (!isSSL && ehloResp.includes("STARTTLS")) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
      ehloResp = await sendCommand("EHLO localhost");
    }

    // AUTH LOGIN
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(account.email));
    const authResp = await sendCommand(btoa(account.app_password));
    if (!authResp.startsWith("235")) {
      throw new Error(`Auth failed: ${authResp}`);
    }

    // Build email content (ported from mail.py MIMEMultipart)
    const html = `<html><body><div data-warmup-id="${batchId}">${body}</div></body></html>`;
    const fromHeader = account.display_name
      ? `"${account.display_name}" <${account.email}>`
      : account.email;

    const emailContent = [
      `From: ${fromHeader}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `Message-ID: <${crypto.randomUUID()}@${account.email.split("@")[1]}>`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `X-Warmup-Batch: ${batchId}`,
      ``,
      html,
    ].join("\r\n");

    await sendCommand(`MAIL FROM:<${account.email}>`);

    const rcptResp = await sendCommand(`RCPT TO:<${toEmail}>`);
    if (rcptResp.startsWith("5")) {
      throw new Error(`Recipient rejected: ${rcptResp}`);
    }

    await sendCommand("DATA");
    await conn.write(encoder.encode(emailContent + "\r\n.\r\n"));
    const dataResp = await readResponse();
    if (!dataResp.startsWith("250")) {
      throw new Error(`Send failed: ${dataResp}`);
    }

    await sendCommand("QUIT");
    return { success: true };
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Main handler — ported from periodic_warmup() in scheduler/actions/warmup.py
// ════════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get all active warmup schedules (like scheduler/main.py finding non-completed warmups)
    const { data: warmups, error: wErr } = await supabase
      .from('warmup_schedules')
      .select('*, email_accounts(*)')
      .eq('status', 'active');

    if (wErr) throw wErr;
    if (!warmups || warmups.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No active warmups' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const warmup of warmups) {
      const warmupId = warmup.id;
      const emailAccount = warmup.email_accounts;

      // ── Check mail server (ported from warmup.py lines 55-62) ──
      if (!emailAccount) {
        await supabase.from('warmup_schedules').update({
          status: 'paused' as any,
          status_text: 'Invalid mail server, please update email account details or pause/delete this warmup',
        }).eq('id', warmupId);
        results.push({ id: warmupId, status: 'failed', reason: 'No email account' });
        continue;
      }

      // ── Check max_days completion (ported from warmup.py lines 68-73) ──
      if (warmup.max_days > 0 && warmup.days_active + 1 > warmup.max_days) {
        await supabase.from('warmup_schedules').update({
          status: 'completed' as any,
          status_text: 'Warmup has been completed',
        }).eq('id', warmupId);
        results.push({ id: warmupId, status: 'completed' });
        continue;
      }

      // ── Calculate send volume (ported from warmup.py lines 108-128) ──
      let sendVolume = warmup.start_volume || 10;

      if (warmup.days_active <= 1) {
        sendVolume = warmup.start_volume || 10;
      } else {
        // Get last warmup day's actual send volume from warmup_logs
        const { data: lastDayLogs } = await supabase
          .from('warmup_logs')
          .select('*')
          .eq('warmup_schedule_id', warmupId)
          .eq('direction', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1);

        // Count emails sent on last day
        const { count: lastDaySent } = await supabase
          .from('warmup_logs')
          .select('*', { count: 'exact', head: true })
          .eq('warmup_schedule_id', warmupId)
          .eq('direction', 'sent')
          .gte('sent_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());

        const lastSendVolume = lastDaySent || sendVolume;

        if (lastSendVolume >= sendVolume) {
          const increaseRate = warmup.increase_rate || 0.3;
          // Ported from warmup.py: if 0.1 <= rate < 1, multiply; if > 1, add flat
          if (increaseRate >= 0.1 && increaseRate < 1) {
            sendVolume = xOfY(increaseRate, lastSendVolume) + lastSendVolume;
          } else if (increaseRate >= 1) {
            sendVolume = Math.round(increaseRate) + lastSendVolume;
          }
        }
      }

      // Cap at target daily limit
      sendVolume = Math.min(sendVolume, warmup.target_daily_limit);

      // ── Check daily send limit on email account ──
      if (emailAccount.sends_today >= emailAccount.daily_send_limit) {
        results.push({ id: warmupId, status: 'skipped', reason: 'Daily send limit reached' });
        continue;
      }
      sendVolume = Math.min(sendVolume, emailAccount.daily_send_limit - emailAccount.sends_today);

      // ── Get warmup email templates (ported from mail.py WarmupEmail.aggregate) ──
      const { data: warmupEmails } = await supabase
        .from('warmup_emails')
        .select('*')
        .eq('user_id', warmup.user_id);

      if (!warmupEmails || warmupEmails.length === 0) {
        await supabase.from('warmup_schedules').update({
          status_text: 'No warmup email templates found. Please add warmup email templates.',
        }).eq('id', warmupId);
        results.push({ id: warmupId, status: 'skipped', reason: 'No warmup email templates' });
        continue;
      }

      // ── Get unused contacts from leads (ported from warmup.py lines 130-144) ──
      const addressesMailed = warmup.addresses_mailed || [];
      
      // Get leads that haven't been mailed yet
      let query = supabase
        .from('leads')
        .select('id, email, name, company')
        .eq('user_id', warmup.user_id)
        .eq('status', 'imported')
        .limit(sendVolume);

      const { data: allLeads } = await query;
      
      // Filter out already mailed addresses (ported from warmup.py lines 132-139)
      const unusedContacts = (allLeads || []).filter(
        lead => !addressesMailed.includes(lead.email)
      ).slice(0, sendVolume);

      if (unusedContacts.length < sendVolume && unusedContacts.length === 0) {
        await supabase.from('warmup_schedules').update({
          status_text: 'The contact list has been used up, consider adding more leads or pause/delete this warmup',
        }).eq('id', warmupId);
        results.push({ id: warmupId, status: 'skipped', reason: 'No unused contacts' });
        continue;
      }

      // ── Send warmup emails in chunks (ported from mail.py send_warmup_emails) ──
      const batchId = generateBatchId();
      const chunkSize = 10; // Same as mail.py
      let sentCount = 0;
      const newAddressesMailed: string[] = [];

      for (let i = 0; i < unusedContacts.length; i += chunkSize) {
        const chunk = unusedContacts.slice(i, i + chunkSize);

        for (const contact of chunk) {
          try {
            // Pick random warmup email template (like WarmupEmail.aggregate $sample)
            const template = warmupEmails[Math.floor(Math.random() * warmupEmails.length)];

            await sendSmtp(
              emailAccount,
              contact.email,
              template.subject,
              template.body,
              batchId,
            );

            // Log the warmup email sent
            await supabase.from('warmup_logs').insert({
              warmup_schedule_id: warmupId,
              user_id: warmup.user_id,
              partner_email: contact.email,
              direction: 'sent',
              subject: template.subject,
            });

            newAddressesMailed.push(contact.email);
            sentCount++;

            // Random delay between sends (5-15 seconds) for natural behavior
            const delay = Math.floor(Math.random() * 10000) + 5000;
            await new Promise(r => setTimeout(r, delay));
          } catch (sendErr: any) {
            console.error(`Warmup send failed to ${contact.email}:`, sendErr.message);
          }
        }
      }

      // ── Update warmup schedule (ported from warmup.py lines 148-171) ──
      const updatedAddresses = [...addressesMailed, ...newAddressesMailed];
      await supabase.from('warmup_schedules').update({
        days_active: warmup.days_active + 1,
        current_daily_limit: sendVolume,
        total_sent: warmup.total_sent + sentCount,
        addresses_mailed: updatedAddresses,
        status_text: `Warmup is running without any issues :) Day ${warmup.days_active + 1} - Sent ${sentCount} emails`,
      }).eq('id', warmupId);

      // Update email account sends_today
      await supabase.from('email_accounts').update({
        sends_today: emailAccount.sends_today + sentCount,
        warmup_level: warmup.days_active + 1,
      }).eq('id', emailAccount.id);

      results.push({
        id: warmupId,
        status: 'success',
        day: warmup.days_active + 1,
        sent: sentCount,
        volume: sendVolume,
      });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Warmup engine error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
