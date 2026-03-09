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
]);

// ── Special-use / reserved domains (RFC 6761 + IANA) ──
const SPECIAL_USE_DOMAINS = new Set([
  "invalid", "localhost", "test", "example", "example.com", "example.net", "example.org",
  "local", "onion", "internal",
]);

// ── Validation logic inspired by python-email-validator ──

/** RFC 5321: local part max 64 chars, total max 254 chars */
const MAX_LOCAL_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;

/** Allowed ASCII chars in local part (unquoted) per RFC 5321/5322 */
const LOCAL_PART_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;

/** Domain label: 1-63 chars, alphanumeric + hyphen, no leading/trailing hyphen */
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

  // Overall length
  if (email.length === 0) return fail('Empty address');
  if (email.length > MAX_EMAIL_LENGTH) return fail(`Address exceeds ${MAX_EMAIL_LENGTH} characters`);

  // Must have exactly one @
  const atIdx = email.lastIndexOf('@');
  if (atIdx <= 0) return fail('Missing @ sign');
  if (email.indexOf('@') !== atIdx) return fail('Multiple @ signs');

  let localPart = email.substring(0, atIdx);
  let domain = email.substring(atIdx + 1);

  // ── Local part checks ──
  if (localPart.length === 0) return fail('Empty local part');
  if (localPart.length > MAX_LOCAL_LENGTH) return fail(`Local part exceeds ${MAX_LOCAL_LENGTH} characters`);
  if (localPart.startsWith('.') || localPart.endsWith('.')) return fail('Local part starts/ends with dot');
  if (localPart.includes('..')) return fail('Consecutive dots in local part');
  if (!LOCAL_PART_RE.test(localPart)) return fail('Invalid characters in local part');

  // ── Domain checks ──
  domain = domain.toLowerCase();
  if (domain.length === 0) return fail('Empty domain');
  if (domain.length > 253) return fail('Domain exceeds 253 characters');

  // Check special-use domains
  const baseDomain = domain.split('.').slice(-1)[0]; // TLD
  if (SPECIAL_USE_DOMAINS.has(domain) || SPECIAL_USE_DOMAINS.has(baseDomain)) {
    return fail(`Special-use/reserved domain: ${domain}`);
  }

  // Must have at least one dot (a TLD alone isn't deliverable)
  if (!domain.includes('.')) return fail('Domain has no dot (not a valid FQDN)');

  // Validate each label
  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length === 0) return fail('Empty domain label (consecutive dots)');
    if (!DOMAIN_LABEL_RE.test(label)) return fail(`Invalid domain label: ${label}`);
  }

  // TLD must not be all-numeric (RFC 3696)
  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) return fail('TLD is all-numeric');

  // ── Normalize ──
  // Lowercase domain (already done), keep local part as-is (case-sensitive per spec, but normalize for storage)
  const normalized = `${localPart}@${domain}`;

  return { syntaxValid: true, syntaxError: null, normalized, localPart, domain };
}

function isDisposable(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

async function checkMX(domain: string): Promise<{ valid: boolean; records: any[] }> {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    return { valid: records.length > 0, records };
  } catch {
    // Fallback: check if domain has an A record (implicit MX per RFC 5321 §5.1)
    try {
      const aRecords = await Deno.resolveDns(domain, "A");
      return { valid: aRecords.length > 0, records: [] };
    } catch {
      return { valid: false, records: [] };
    }
  }
}

async function checkCatchAll(domain: string): Promise<boolean> {
  // Attempt to detect catch-all by checking if a random address resolves
  // This is a heuristic—true catch-all detection requires SMTP RCPT TO
  try {
    const records = await Deno.resolveDns(domain, "MX");
    // If domain has wildcard-like MX config, it's more likely catch-all
    // We can't truly verify without SMTP, so just flag domains with only 1 low-priority MX
    return records.length === 1;
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

    // Fetch leads
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
      // Step 1: Syntax validation (python-email-validator style)
      const syntax = validateEmailSyntax(lead.email);
      
      let disposable = false;
      let mxValid = false;
      let catchAll = false;
      let statusReason = syntax.syntaxError || '';

      if (syntax.syntaxValid) {
        // Step 2: Disposable domain check
        disposable = isDisposable(syntax.domain);
        if (disposable) {
          statusReason = 'Disposable/temporary email domain';
        } else {
          // Step 3: MX record check (with A-record fallback per RFC 5321)
          const mx = await checkMX(syntax.domain);
          mxValid = mx.valid;
          if (!mxValid) {
            statusReason = 'Domain has no MX or A records (undeliverable)';
          } else {
            // Step 4: Catch-all heuristic
            catchAll = await checkCatchAll(syntax.domain);
          }
        }
      }

      const overallStatus = !syntax.syntaxValid ? 'invalid'
        : disposable ? 'invalid'
        : !mxValid ? 'invalid'
        : catchAll ? 'risky'
        : 'valid';

      // Upsert validation record
      await supabase.from('email_validations').upsert({
        lead_id: lead.id,
        user_id: user.id,
        email: syntax.normalized,
        status: overallStatus,
        syntax_valid: syntax.syntaxValid,
        mx_valid: mxValid,
        is_disposable: disposable,
        is_catchall: catchAll,
        validated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' });

      // Update lead validation_status
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
