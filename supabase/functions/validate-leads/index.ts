import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Disposable domains (expanded) ──
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","tempmail.com","guerrillamail.com","throwaway.email","yopmail.com",
  "sharklasers.com","guerrillamailblock.com","grr.la","dispostable.com","mailnesia.com",
  "maildrop.cc","10minutemail.com","trashmail.com","fakeinbox.com","tempinbox.com",
  "getnada.com","mohmal.com","mailcatch.com","harakirimail.com","discard.email",
  "33mail.com","guerrillamail.info","mailexpire.com","jetable.org","spamgourmet.com",
  "tempr.email","temp-mail.org","emailondeck.com","throwam.com","tmail.ws",
  "guerrillamail.de","guerrillamail.net","guerrillamail.org","spam4.me","trashmail.me",
  "bugmenot.com","notmailinator.com","mailnull.com","spamhereplease.com","safetymail.info",
  "minutemail.com","tempail.com","throwaway.email","trash-mail.com","mytemp.email",
  "mailbox92.biz","burnermail.io","inboxbear.com","guerrillamail.biz","spamfree24.org",
]);

// ── Special-use / reserved domains (RFC 6761 + IANA) ──
const SPECIAL_USE_DOMAINS = new Set([
  "invalid", "localhost", "test", "example", "example.com", "example.net", "example.org",
  "local", "onion", "internal",
]);

// ── Validation logic inspired by python-email-validator ──

const MAX_LOCAL_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;
const LOCAL_PART_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_LABEL_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

interface ValidationResult {
  syntaxValid: boolean;
  syntaxError: string | null;
  normalized: string;
  localPart: string;
  domain: string;
}

function validateEmailSyntax(rawEmail: string): ValidationResult {
  const fail = (reason: string): ValidationResult => ({
    syntaxValid: false, syntaxError: reason, normalized: rawEmail, localPart: '', domain: '',
  });

  const email = rawEmail.trim();
  if (email.length === 0) return fail('Empty address');
  if (email.length > MAX_EMAIL_LENGTH) return fail(`Address exceeds ${MAX_EMAIL_LENGTH} characters`);

  const atIdx = email.lastIndexOf('@');
  if (atIdx <= 0) return fail('Missing @ sign');
  if (email.indexOf('@') !== atIdx) return fail('Multiple @ signs');

  const localPart = email.substring(0, atIdx);
  let domain = email.substring(atIdx + 1);

  if (localPart.length === 0) return fail('Empty local part');
  if (localPart.length > MAX_LOCAL_LENGTH) return fail(`Local part exceeds ${MAX_LOCAL_LENGTH} characters`);
  if (localPart.startsWith('.') || localPart.endsWith('.')) return fail('Local part starts/ends with dot');
  if (localPart.includes('..')) return fail('Consecutive dots in local part');
  if (!LOCAL_PART_RE.test(localPart)) return fail('Invalid characters in local part');

  domain = domain.toLowerCase();
  if (domain.length === 0) return fail('Empty domain');
  if (domain.length > 253) return fail('Domain exceeds 253 characters');

  const baseDomain = domain.split('.').slice(-1)[0];
  if (SPECIAL_USE_DOMAINS.has(domain) || SPECIAL_USE_DOMAINS.has(baseDomain)) {
    return fail(`Special-use/reserved domain: ${domain}`);
  }

  if (!domain.includes('.')) return fail('Domain has no dot (not a valid FQDN)');

  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length === 0) return fail('Empty domain label (consecutive dots)');
    if (!DOMAIN_LABEL_RE.test(label)) return fail(`Invalid domain label: ${label}`);
  }

  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) return fail('TLD is all-numeric');

  const normalized = `${localPart}@${domain}`;
  return { syntaxValid: true, syntaxError: null, normalized, localPart, domain };
}

function isDisposable(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

interface MXResult {
  valid: boolean;
  nullMX: boolean;
  records: any[];
}

async function checkMX(domain: string): Promise<MXResult> {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    // RFC 7505: Null MX — single MX with preference 0 and exchange "."
    if (records.length === 1 && records[0].exchange === "." || records[0]?.exchange === "") {
      return { valid: false, nullMX: true, records };
    }
    return { valid: records.length > 0, nullMX: false, records };
  } catch {
    // Fallback: check A record (implicit MX per RFC 5321 §5.1)
    try {
      const aRecords = await Deno.resolveDns(domain, "A");
      return { valid: aRecords.length > 0, nullMX: false, records: [] };
    } catch {
      return { valid: false, nullMX: false, records: [] };
    }
  }
}

async function checkSPFRejectAll(domain: string): Promise<boolean> {
  try {
    const txtRecords = await Deno.resolveDns(domain, "TXT");
    for (const record of txtRecords) {
      const txt = Array.isArray(record) ? record.join('') : String(record);
      // "v=spf1 -all" means domain explicitly rejects all mail
      if (txt.trim().toLowerCase() === 'v=spf1 -all') {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function checkCatchAll(domain: string, mxRecords: any[]): Promise<boolean> {
  // Improved heuristic: only flag if the MX exchange looks like a wildcard/catch-all service
  // A single MX alone is NOT sufficient — many legitimate domains have one MX
  try {
    if (mxRecords.length === 0) return false;
    // Check if any MX record exchange contains wildcard-like patterns
    for (const mx of mxRecords) {
      const exchange = String(mx.exchange || '').toLowerCase();
      if (exchange.includes('catchall') || exchange.includes('catch-all') || exchange.includes('wildcard')) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lead_ids } = await req.json();
    if (!lead_ids || !Array.isArray(lead_ids)) {
      return new Response(JSON.stringify({ error: 'lead_ids array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, email')
      .in('id', lead_ids)
      .eq('user_id', user.id);

    if (fetchError || !leads) {
      return new Response(JSON.stringify({ error: 'Failed to fetch leads' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const lead of leads) {
      const syntax = validateEmailSyntax(lead.email);

      let disposable = false;
      let mxValid = false;
      let nullMX = false;
      let catchAll = false;
      let spfRejectAll = false;
      let statusReason = syntax.syntaxError || '';

      if (syntax.syntaxValid) {
        disposable = isDisposable(syntax.domain);
        if (disposable) {
          statusReason = 'Disposable/temporary email domain';
        } else {
          const mx = await checkMX(syntax.domain);
          mxValid = mx.valid;
          nullMX = mx.nullMX;

          if (nullMX) {
            statusReason = 'Domain has Null MX record (RFC 7505) — does not accept email';
          } else if (!mxValid) {
            statusReason = 'Domain has no MX or A records (undeliverable)';
          } else {
            // Check SPF reject-all
            spfRejectAll = await checkSPFRejectAll(syntax.domain);
            if (spfRejectAll) {
              statusReason = 'Domain SPF record rejects all mail (v=spf1 -all)';
            } else {
              catchAll = await checkCatchAll(syntax.domain, mx.records);
              if (catchAll) {
                statusReason = 'Domain appears to be a catch-all (accepts any address)';
              }
            }
          }
        }
      }

      const overallStatus = !syntax.syntaxValid ? 'invalid'
        : disposable ? 'invalid'
        : nullMX ? 'invalid'
        : !mxValid ? 'invalid'
        : spfRejectAll ? 'invalid'
        : catchAll ? 'risky'
        : 'valid';

      await supabase.from('email_validations').upsert({
        lead_id: lead.id,
        user_id: user.id,
        email: syntax.normalized,
        status: overallStatus,
        syntax_valid: syntax.syntaxValid,
        mx_valid: mxValid,
        is_disposable: disposable,
        is_catchall: catchAll,
        reason: statusReason || null,
        validated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' });

      await supabase.from('leads').update({ validation_status: overallStatus }).eq('id', lead.id);

      results.push({
        lead_id: lead.id,
        email: syntax.normalized,
        status: overallStatus,
        reason: statusReason,
        syntax_valid: syntax.syntaxValid,
        mx_valid: mxValid,
        is_disposable: disposable,
        is_catchall: catchAll,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Validation error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
