import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const fid = url.searchParams.get("fid");

  if (!type || !fid) {
    return new Response("Missing params", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get followup to find user_id
  const { data: followup } = await supabase
    .from("followups")
    .select("user_id")
    .eq("id", fid)
    .single();

  if (followup) {
    const event: Record<string, any> = {
      followup_id: fid,
      user_id: followup.user_id,
      event_type: type,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      user_agent: req.headers.get("user-agent") || null,
    };

    if (type === "click") {
      event.link_url = url.searchParams.get("url") || null;
    }

    await supabase.from("tracking_events").insert(event);
  }

  if (type === "open") {
    return new Response(PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  if (type === "click") {
    const targetUrl = url.searchParams.get("url");
    if (targetUrl) {
      return new Response(null, {
        status: 302,
        headers: { Location: decodeURIComponent(targetUrl) },
      });
    }
  }

  return new Response("OK", { status: 200 });
});
