import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ════════════════════════════════════════════════════════════════════════════════
// Faithful port of https://github.com/JoshData/python-email-validator
// ════════════════════════════════════════════════════════════════════════════════

// ── RFC Constants (from rfc_constants.py) ──
const EMAIL_MAX_LENGTH = 254;
const LOCAL_PART_MAX_LENGTH = 64;
const DOMAIN_MAX_LENGTH = 253;
const DNS_LABEL_LENGTH_LIMIT = 63;

// RFC 5322 3.2.3 — permitted chars in dot-atom local part (ASCII only)
const ATEXT = "a-zA-Z0-9_!#$%&'*+\\-/=?^`{|}~";
const DOT_ATOM_TEXT = new RegExp(`^[${ATEXT}]+(?:\\.[${ATEXT}]+)*$`);

// RFC 952 + RFC 6531 — hostname characters (ASCII alphanumerics, hyphens, dots)
const HOSTNAME_LABEL = /^(?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]*)?[a-zA-Z0-9])$/;
const DOMAIN_NAME_REGEX = /[A-Za-z]$/; // all TLDs currently end with a letter

// ── IANA Special-Use Domain Names (from __init__.py) ──
// https://www.iana.org/assignments/special-use-domain-names/special-use-domain-names.txt
const SPECIAL_USE_DOMAIN_NAMES = [
  "arpa",
  "invalid",
  "local",
  "localhost",
  "onion",
  "test",
  // example domains will fail MX checks anyway via Null MX
];

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
  "minutemail.com","tempail.com","trash-mail.com","mytemp.email",
  "mailbox92.biz","burnermail.io","inboxbear.com","guerrillamail.biz","spamfree24.org",
]);

// ════════════════════════════════════════════════════════════════════════════════
// Syntax Validation (ported from syntax.py)
// ════════════════════════════════════════════════════════════════════════════════

interface SyntaxResult {
  valid: boolean;
  error: string | null;
  localPart: string;
  asciiDomain: string;
  normalized: string;
}

function validateSyntax(rawEmail: string): SyntaxResult {
  const fail = (reason: string): SyntaxResult => ({
    valid: false, error: reason, localPart: '', asciiDomain: '', normalized: rawEmail.trim(),
  });

  const email = rawEmail.trim();
  if (email.length === 0) return fail('There must be something before the @-sign.');

  // Split at the last @ (python-email-validator uses split_email which handles quoted strings,
  // but for cold outreach emails quoted local parts are essentially never used)
  const atIdx = email.lastIndexOf('@');
  if (atIdx < 0) return fail('An email address must have an @-sign.');
  if (atIdx === 0) return fail('There must be something before the @-sign.');

  const localPart = email.substring(0, atIdx);
  let domain = email.substring(atIdx + 1);

  // ── Local part validation (validate_email_local_part) ──

  // Length check (RFC 5321 4.5.3.1.1) — strict mode
  if (localPart.length > LOCAL_PART_MAX_LENGTH) {
    const diff = localPart.length - LOCAL_PART_MAX_LENGTH;
    return fail(`The email address is too long before the @-sign (${diff} character${diff > 1 ? 's' : ''} too many).`);
  }

  // Check against dot-atom regex (RFC 5322 3.2.3)
  if (!DOT_ATOM_TEXT.test(localPart)) {
    // Provide specific error messages like python-email-validator

    // Check for dots issues first (check_dot_atom)
    if (localPart.startsWith('.')) return fail('An email address cannot start with a period.');
    if (localPart.endsWith('.')) return fail('An email address cannot have a period immediately before the @-sign.');
    if (localPart.includes('..')) return fail('An email address cannot have two periods in a row.');

    // Check for invalid characters
    const invalidChars = new Set<string>();
    for (const c of localPart) {
      if (!/[a-zA-Z0-9.!#$%&'*+\-/=?^_`{|}~]/.test(c)) {
        invalidChars.add(c);
      }
    }
    if (invalidChars.size > 0) {
      return fail(`The email address contains invalid characters before the @-sign: ${[...invalidChars].map(c => `'${c}'`).join(', ')}.`);
    }

    return fail('The email address contains invalid characters before the @-sign.');
  }

  // ── Domain validation (validate_email_domain_name) ──

  domain = domain.toLowerCase();

  if (domain.length === 0) return fail('There must be something after the @-sign.');

  // Check for invalid characters in domain (RFC 952 + RFC 6531 3.3)
  const domainInvalidChars = new Set<string>();
  for (const c of domain) {
    if (!/[a-zA-Z0-9.\-]/.test(c)) {
      domainInvalidChars.add(c);
    }
  }
  if (domainInvalidChars.size > 0) {
    return fail(`The part after the @-sign contains invalid characters: ${[...domainInvalidChars].map(c => `'${c}'`).join(', ')}.`);
  }

  // check_dot_atom for domain (is_hostname=true)
  if (domain.endsWith('.')) return fail('An email address cannot end with a period.');
  if (domain.startsWith('.')) return fail('An email address cannot have a period immediately after the @-sign.');
  if (domain.includes('..')) return fail('An email address cannot have two periods in a row.');
  if (domain.endsWith('-')) return fail('An email address cannot end with a hyphen.');
  if (domain.startsWith('-')) return fail('An email address cannot have a hyphen immediately after the @-sign.');
  if (domain.includes('.-') || domain.includes('-.')) {
    return fail('An email address cannot have a period and a hyphen next to each other.');
  }

  // Check for R-LDH labels (RFC 5890)
  for (const label of domain.split('.')) {
    if (/^(?!xn)..--/i.test(label)) {
      return fail('An email address cannot have two letters followed by two dashes immediately after the @-sign or after a period, except Punycode.');
    }
  }

  // Validate each label against hostname regex
  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length === 0) return fail('An email address cannot have two periods in a row.');
    if (!HOSTNAME_LABEL.test(label)) {
      return fail(`The part after the @-sign contains an invalid label: '${label}'.`);
    }
    // Label length check (RFC 1035 2.3.1)
    if (label.length > DNS_LABEL_LENGTH_LIMIT) {
      const diff = label.length - DNS_LABEL_LENGTH_LIMIT;
      return fail(`After the @-sign, periods cannot be separated by so many characters (${diff} character${diff > 1 ? 's' : ''} too many).`);
    }
  }

  // Domain must have at least one dot (globally deliverable)
  if (!domain.includes('.')) {
    return fail('The part after the @-sign is not valid. It should have a period.');
  }

  // TLD must end with a letter (all current TLDs do)
  if (!DOMAIN_NAME_REGEX.test(domain)) {
    return fail('The part after the @-sign is not valid. It is not within a valid top-level domain.');
  }

  // Domain length check (RFC 1035 2.3.4 / RFC 5321 4.5.3.1.2)
  if (domain.length > DOMAIN_MAX_LENGTH) {
    const diff = domain.length - DOMAIN_MAX_LENGTH;
    return fail(`The email address is too long after the @-sign (${diff} character${diff > 1 ? 's' : ''} too many).`);
  }

  // Check special-use domain names (from __init__.py SPECIAL_USE_DOMAIN_NAMES)
  for (const sud of SPECIAL_USE_DOMAIN_NAMES) {
    if (domain === sud || domain.endsWith('.' + sud)) {
      return fail('The part after the @-sign is a special-use or reserved name that cannot be used with email.');
    }
  }

  // Total email length check (RFC 3696 + errata)
  const normalized = `${localPart}@${domain}`;
  if (normalized.length > EMAIL_MAX_LENGTH) {
    const diff = normalized.length - EMAIL_MAX_LENGTH;
    return fail(`The email address is too long (${diff} character${diff > 1 ? 's' : ''} too many).`);
  }

  return {
    valid: true,
    error: null,
    localPart,
    asciiDomain: domain,
    normalized,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// Deliverability Checks (ported from deliverability.py)
// ════════════════════════════════════════════════════════════════════════════════

interface DeliverabilityResult {
  deliverable: boolean;
  error: string | null;
  mxRecords: Array<{ preference: number; exchange: string }>;
  mxFallbackType: string | null; // null = real MX, "A" = A-record fallback, "AAAA" = AAAA fallback
  unknownDeliverability: string | null; // "timeout", "no_nameservers"
}

async function validateDeliverability(domain: string): Promise<DeliverabilityResult> {
  const fail = (reason: string): DeliverabilityResult => ({
    deliverable: false, error: reason, mxRecords: [], mxFallbackType: null, unknownDeliverability: null,
  });

  try {
    // Step 1: Try MX records (RFC 5321 Section 5)
    try {
      const mxRecords = await Deno.resolveDns(domain, "MX");

      // Sort by priority and normalize exchange names (remove trailing dot)
      const mtas = mxRecords
        .map(r => ({ preference: r.preference, exchange: String(r.exchange).replace(/\.$/, '') }))
        .sort((a, b) => a.preference - b.preference);

      // RFC 7505: Null MX — filter out records with empty exchange
      const nonNullMtas = mtas.filter(m => m.exchange !== '' && m.exchange !== '.');
      if (nonNullMtas.length === 0) {
        // All MX records are null — domain explicitly rejects email
        return fail(`The domain name ${domain} does not accept email.`);
      }

      return {
        deliverable: true,
        error: null,
        mxRecords: nonNullMtas,
        mxFallbackType: null,
        unknownDeliverability: null,
      };
    } catch (_mxError) {
      // No MX records — fall back to A record (RFC 5321 Section 5)
      try {
        const aRecords = await Deno.resolveDns(domain, "A");
        // Check for globally routable IPs (python-email-validator checks is_global)
        const globalRecords = aRecords.filter(ip => {
          // Reject private/loopback/link-local ranges
          if (ip.startsWith('10.') || ip.startsWith('127.') || ip.startsWith('0.')) return false;
          if (ip.startsWith('172.')) {
            const second = parseInt(ip.split('.')[1]);
            if (second >= 16 && second <= 31) return false;
          }
          if (ip.startsWith('192.168.')) return false;
          if (ip.startsWith('169.254.')) return false;
          return true;
        });

        if (globalRecords.length === 0) {
          // Try AAAA fallback
          try {
            const aaaaRecords = await Deno.resolveDns(domain, "AAAA");
            if (aaaaRecords.length > 0) {
              // Check SPF reject-all since we're using A/AAAA fallback
              const spfReject = await checkSPFRejectAll(domain);
              if (spfReject) {
                return fail(`The domain name ${domain} does not send email.`);
              }
              return {
                deliverable: true, error: null,
                mxRecords: [{ preference: 0, exchange: domain }],
                mxFallbackType: "AAAA",
                unknownDeliverability: null,
              };
            }
          } catch {
            // No AAAA either
          }
          return fail(`The domain name ${domain} does not accept email.`);
        }

        // A record found — check SPF reject-all (python-email-validator does this
        // only when falling back to A/AAAA, not when MX records exist)
        const spfReject = await checkSPFRejectAll(domain);
        if (spfReject) {
          return fail(`The domain name ${domain} does not send email.`);
        }

        return {
          deliverable: true, error: null,
          mxRecords: [{ preference: 0, exchange: domain }],
          mxFallbackType: "A",
          unknownDeliverability: null,
        };
      } catch (_aError) {
        // Try AAAA
        try {
          const aaaaRecords = await Deno.resolveDns(domain, "AAAA");
          if (aaaaRecords.length > 0) {
            const spfReject = await checkSPFRejectAll(domain);
            if (spfReject) {
              return fail(`The domain name ${domain} does not send email.`);
            }
            return {
              deliverable: true, error: null,
              mxRecords: [{ preference: 0, exchange: domain }],
              mxFallbackType: "AAAA",
              unknownDeliverability: null,
            };
          }
        } catch {
          // Fall through
        }

        // Check if NXDOMAIN (domain doesn't exist at all)
        return fail(`The domain name ${domain} does not exist.`);
      }
    }
  } catch (error) {
    // Timeout or nameserver failure — unknown deliverability (don't reject)
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return {
        deliverable: true, error: null, mxRecords: [],
        mxFallbackType: null, unknownDeliverability: "timeout",
      };
    }
    return {
      deliverable: true, error: null, mxRecords: [],
      mxFallbackType: null, unknownDeliverability: "no_nameservers",
    };
  }
}

// SPF reject-all check (from deliverability.py lines 115-129)
// Only checked when no MX record exists and falling back to A/AAAA.
// "v=spf1 -all" means the domain explicitly sends no email.
async function checkSPFRejectAll(domain: string): Promise<boolean> {
  try {
    const txtRecords = await Deno.resolveDns(domain, "TXT");
    for (const record of txtRecords) {
      const txt = Array.isArray(record) ? record.join('') : String(record);
      if (txt.trim().toLowerCase() === 'v=spf1 -all') {
        return true;
      }
    }
    return false;
  } catch {
    return false; // No TXT records — no SPF policy, can't take action
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Disposable domain check (not in python-email-validator, but useful for cold email)
// ════════════════════════════════════════════════════════════════════════════════

function isDisposable(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

// ════════════════════════════════════════════════════════════════════════════════
// Main handler
// ════════════════════════════════════════════════════════════════════════════════

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
      // Step 1: Syntax validation (syntax.py)
      const syntax = validateSyntax(lead.email);

      let disposable = false;
      let mxValid = false;
      let catchAll = false;
      let statusReason = syntax.error || '';
      let deliverabilityInfo: DeliverabilityResult | null = null;

      if (syntax.valid) {
        // Step 2: Disposable check
        disposable = isDisposable(syntax.asciiDomain);
        if (disposable) {
          statusReason = 'Disposable/temporary email domain';
        } else {
          // Step 3: Deliverability check (deliverability.py)
          deliverabilityInfo = await validateDeliverability(syntax.asciiDomain);

          if (!deliverabilityInfo.deliverable) {
            statusReason = deliverabilityInfo.error || 'Domain does not accept email';
            mxValid = false;
          } else {
            mxValid = true;
            if (deliverabilityInfo.unknownDeliverability) {
              statusReason = `Unknown deliverability: ${deliverabilityInfo.unknownDeliverability}`;
            }
            if (deliverabilityInfo.mxFallbackType) {
              // Using A/AAAA fallback is less reliable
              statusReason = `No MX record; using ${deliverabilityInfo.mxFallbackType}-record fallback`;
            }
          }
        }
      }

      // Determine overall status
      const overallStatus = !syntax.valid ? 'invalid'
        : disposable ? 'invalid'
        : !deliverabilityInfo?.deliverable ? 'invalid'
        : deliverabilityInfo?.unknownDeliverability ? 'risky'
        : deliverabilityInfo?.mxFallbackType ? 'risky'
        : 'valid';

      // Persist to email_validations table
      await supabase.from('email_validations').upsert({
        lead_id: lead.id,
        user_id: user.id,
        email: syntax.normalized,
        status: overallStatus,
        syntax_valid: syntax.valid,
        mx_valid: mxValid,
        is_disposable: disposable,
        is_catchall: catchAll,
        reason: statusReason || null,
        validated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' });

      // Update lead validation_status
      await supabase.from('leads').update({ validation_status: overallStatus }).eq('id', lead.id);

      results.push({
        lead_id: lead.id,
        email: syntax.normalized,
        status: overallStatus,
        reason: statusReason,
        syntax_valid: syntax.valid,
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
