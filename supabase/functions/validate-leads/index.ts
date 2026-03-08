import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Disposable email domains (seed list)
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","tempmail.com","guerrillamail.com","throwaway.email","yopmail.com",
  "sharklasers.com","guerrillamailblock.com","grr.la","dispostable.com","mailnesia.com",
  "maildrop.cc","10minutemail.com","trashmail.com","fakeinbox.com","tempinbox.com",
  "getnada.com","mohmal.com","mailcatch.com","harakirimail.com","discard.email",
  "33mail.com","guerrillamail.info","mailexpire.com","jetable.org","spamgourmet.com",
  "tempr.email","temp-mail.org","emailondeck.com","throwam.com","tmail.ws",
]);

function isValidSyntax(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}

async function checkMX(domain: string): Promise<{ valid: boolean; records: any[] }> {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    return { valid: records.length > 0, records };
  } catch {
    return { valid: false, records: [] };
  }
}

function isDisposable(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
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
      const email = lead.email.trim().toLowerCase();
      const domain = email.split('@')[1];
      
      const syntaxValid = isValidSyntax(email);
      const disposable = isDisposable(domain);
      let mxValid = false;
      let catchAll = false;

      if (syntaxValid && !disposable) {
        const mx = await checkMX(domain);
        mxValid = mx.valid;
      }

      const overallStatus = !syntaxValid ? 'invalid' 
        : disposable ? 'invalid'
        : !mxValid ? 'invalid'
        : 'valid';

      // Upsert validation record
      await supabase.from('email_validations').upsert({
        lead_id: lead.id,
        user_id: user.id,
        email,
        status: overallStatus,
        syntax_valid: syntaxValid,
        mx_valid: mxValid,
        is_disposable: disposable,
        is_catchall: catchAll,
        validated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' });

      // Update lead validation_status
      await supabase.from('leads').update({ validation_status: overallStatus }).eq('id', lead.id);

      results.push({ lead_id: lead.id, email, status: overallStatus, syntax_valid: syntaxValid, mx_valid: mxValid, is_disposable: disposable });
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
