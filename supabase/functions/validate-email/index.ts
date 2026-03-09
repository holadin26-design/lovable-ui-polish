import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
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
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email_account_id } = await req.json();

    if (!email_account_id) {
      return new Response(JSON.stringify({ success: false, error: 'email_account_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the email account
    const { data: account, error: fetchError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', email_account_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !account) {
      return new Response(JSON.stringify({ success: false, error: 'Email account not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { smtp: boolean; imap: boolean; errors: string[] } = {
      smtp: false,
      imap: false,
      errors: [],
    };

    // Validate SMTP by attempting a connection
    try {
      const smtpConn = await Deno.connect({
        hostname: account.smtp_host,
        port: account.smtp_port,
      });
      
      const buf = new Uint8Array(1024);
      await smtpConn.read(buf);
      const greeting = new TextDecoder().decode(buf);
      
      if (greeting.includes('220')) {
        results.smtp = true;
        console.log('SMTP connection successful:', account.smtp_host);
      } else {
        results.errors.push(`SMTP: Unexpected response: ${greeting.substring(0, 100)}`);
      }
      
      smtpConn.close();
    } catch (smtpError: unknown) {
      const msg = smtpError instanceof Error ? smtpError.message : 'Unknown error';
      results.errors.push(`SMTP connection failed: ${msg}`);
      console.error('SMTP validation error:', msg);
    }

    // Validate IMAP by attempting a connection
    try {
      const imapConn = await Deno.connectTls({
        hostname: account.imap_host,
        port: account.imap_port,
      });
      
      const buf = new Uint8Array(1024);
      await imapConn.read(buf);
      const greeting = new TextDecoder().decode(buf);
      
      if (greeting.includes('OK')) {
        results.imap = true;
        console.log('IMAP connection successful:', account.imap_host);
      } else {
        results.errors.push(`IMAP: Unexpected response: ${greeting.substring(0, 100)}`);
      }
      
      imapConn.close();
    } catch (imapError: unknown) {
      const msg = imapError instanceof Error ? imapError.message : 'Unknown error';
      results.errors.push(`IMAP connection failed: ${msg}`);
      console.error('IMAP validation error:', msg);
    }

    const success = results.smtp && results.imap;

    return new Response(JSON.stringify({
      success,
      smtp: results.smtp,
      imap: results.imap,
      errors: results.errors,
      message: success
        ? 'Both SMTP and IMAP connections validated successfully!'
        : `Validation issues: ${results.errors.join('; ')}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
