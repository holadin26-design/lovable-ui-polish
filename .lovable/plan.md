

# Implementation Plan: Email Engine, Finder, Tracking, Reply Detection, Unsubscribe

## Summary

Build 5 backend Edge Functions and update frontend pages to wire everything together into a working cold email outreach engine.

---

## 1. Send Email Engine (`send-email` Edge Function)

**What it does:** Processes pending followups in scheduled batches, sends via SMTP using the linked email account, respects daily limits.

- **SMTP delivery** using Deno native `Deno.connect` + STARTTLS (port 587) or `Deno.connectTls` (port 465)
- Fetches pending followups where `scheduled_for <= now()` and `status = 'pending'`
- For each followup: resolve the email account, check `sends_today < daily_send_limit`, send via SMTP with AUTH LOGIN
- Injects tracking pixel (`<img>` tag) and wraps links through the `track` function for open/click tracking
- On success: update followup `status = 'sent'`, `sent_at = now()`, store `message_id`; increment `sends_today`
- On failure: update `status = 'failed'`, store `bounce_reason`
- Add randomized 5-30s delay between sends to avoid spam detection
- **No auth required** (called via cron), uses service role key internally

**Variable substitution:** Replace `{{name}}`, `{{company}}`, `{{email}}`, `{{personalized_line}}`, and custom fields from the lead record before sending.

**Config:** Add to `supabase/config.toml` with `verify_jwt = false`.

**Cron job:** Set up `pg_cron` + `pg_net` to invoke `send-email` every 5 minutes.

---

## 2. Open/Click Tracking (`track` Edge Function)

**What it does:** Serves a tracking pixel for opens and redirects for clicks, logging events to `tracking_events`.

- `GET /track?type=open&fid=<followup_id>` -- returns 1x1 transparent GIF, inserts `event_type = 'open'`
- `GET /track?type=click&fid=<followup_id>&url=<encoded_url>` -- inserts `event_type = 'click'` with `link_url`, then 302 redirects to the URL
- Captures `ip_address` from request headers and `user_agent`
- Uses service role key to insert (the `set_tracking_event_user_id` trigger auto-fills `user_id`)
- **No JWT required** (public endpoint for email recipients)

**Config:** `verify_jwt = false` in config.toml.

---

## 3. Reply Detection (`check-replies` Edge Function)

**What it does:** Connects to IMAP for each email account, checks for replies to sent followups using `In-Reply-To` / `References` headers matching stored `message_id`.

- Fetches all email accounts with active campaigns
- For each account: connect via `Deno.connectTls` to IMAP, LOGIN, SELECT INBOX, SEARCH for recent unseen messages
- Parse headers to match `message_id` from followups table
- On match: update followup `status = 'replied'`, update lead `status = 'replied'`, insert tracking event
- Uses service role key, invoked via cron every 10 minutes

---

## 4. Email Finder (`email-finder` Edge Function)

**What it does:** Custom email discovery using common pattern generation + MX validation.

- Input: `{ names: [{ first_name, last_name, domain }] }`
- For each entry: generate candidate patterns (first@, first.last@, firstl@, flast@, first_last@, etc.)
- Validate each candidate: DNS MX lookup via `Deno.resolveDns`, SMTP RCPT TO verification where possible
- Return scored results with confidence levels
- Uses Lovable AI (`google/gemini-3-flash-preview`) to suggest most likely pattern based on company domain conventions
- Requires auth (user's JWT)

**Frontend:** Add "Find Emails" button on the Leads page that opens a dialog for bulk domain-based email discovery.

---

## 5. Unsubscribe Handling (`unsubscribe` Edge Function + Page)

**What it does:** Public unsubscribe endpoint + page that adds email to suppressions table.

- `GET /unsubscribe?fid=<followup_id>&email=<email>` -- serves a simple HTML confirmation page
- `POST /unsubscribe` with `{ followup_id, email }` -- inserts into `suppressions`, cancels pending followups for that email
- The `send-email` function checks suppressions before sending
- All outgoing emails include `List-Unsubscribe` header and an unsubscribe link in the footer

**Frontend:** Add `/unsubscribe` public route in App.tsx for the confirmation page.

---

## 6. Frontend Wiring

- **Dashboard:** Add "Process Queue" button to manually trigger `send-email`
- **Analytics:** Query `tracking_events` for real open/click counts instead of placeholder fields
- **Campaigns:** Add "Launch" flow that generates followups for all assigned leads based on campaign steps
- **Settings:** Show `sends_today` / `daily_send_limit` per account

---

## Database Changes

- **Migration:** Add `lead_id` column to `followups` table (nullable FK to leads) for variable substitution
- **Migration:** Enable `pg_cron` and `pg_net` extensions, create cron schedules for `send-email` (every 5 min) and `check-replies` (every 10 min)
- **Migration:** Add `List-Unsubscribe` support column or handle in code

---

## Files to Create/Edit

| Action | File |
|--------|------|
| Create | `supabase/functions/send-email/index.ts` |
| Create | `supabase/functions/track/index.ts` |
| Create | `supabase/functions/check-replies/index.ts` |
| Create | `supabase/functions/email-finder/index.ts` |
| Create | `supabase/functions/unsubscribe/index.ts` |
| Create | `src/pages/Unsubscribe.tsx` |
| Edit | `supabase/config.toml` (add function configs) |
| Edit | `src/App.tsx` (add unsubscribe route) |
| Edit | `src/pages/Campaigns.tsx` (launch generates followups) |
| Edit | `src/pages/AnalyticsPage.tsx` (real tracking data) |
| Edit | `src/pages/LeadImport.tsx` (email finder button) |
| Edit | `src/pages/Dashboard.tsx` (process queue button) |
| Migration | Add `lead_id` to followups, enable pg_cron/pg_net, create cron jobs |

