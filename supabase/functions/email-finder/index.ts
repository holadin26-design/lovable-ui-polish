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
    const { names } = await req.json();

    if (!names || !Array.isArray(names)) {
      return new Response(JSON.stringify({ error: "Provide names array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const entry of names) {
      const { first_name, last_name, domain } = entry;
      if (!first_name || !last_name || !domain) {
        results.push({ ...entry, error: "Missing first_name, last_name, or domain" });
        continue;
      }

      const f = first_name.toLowerCase().replace(/[^a-z]/g, "");
      const l = last_name.toLowerCase().replace(/[^a-z]/g, "");

      // Generate candidate patterns
      const candidates = [
        `${f}@${domain}`,
        `${f}.${l}@${domain}`,
        `${f}${l}@${domain}`,
        `${f[0]}${l}@${domain}`,
        `${f}${l[0]}@${domain}`,
        `${f}_${l}@${domain}`,
        `${f}-${l}@${domain}`,
        `${l}@${domain}`,
        `${l}.${f}@${domain}`,
        `${f[0]}.${l}@${domain}`,
      ];

      // Check MX records
      let hasMx = false;
      try {
        const mxRecords = await Deno.resolveDns(domain, "MX");
        hasMx = mxRecords.length > 0;
      } catch {
        results.push({
          ...entry,
          candidates: [],
          error: "No MX records found",
          confidence: "none",
        });
        continue;
      }

      if (!hasMx) {
        results.push({
          ...entry,
          candidates: [],
          error: "No MX records",
          confidence: "none",
        });
        continue;
      }

      // Score candidates by common patterns
      const scored = candidates.map((email, idx) => ({
        email,
        score: Math.max(0, 100 - idx * 10), // Simple scoring: first patterns more common
      }));

      results.push({
        ...entry,
        candidates: scored,
        confidence: "medium",
        mx_valid: true,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
