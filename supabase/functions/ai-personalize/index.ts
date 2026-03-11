import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { leads, template, aiInstructions } = await req.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(JSON.stringify({ error: "No leads provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const results: any[] = [];

    for (const lead of leads) {
      // Interpolate template variables
      let baseSubject = template.subject;
      let baseBody = template.body;
      for (const [key, value] of Object.entries(lead)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
        baseSubject = baseSubject.replace(regex, String(value || ""));
        baseBody = baseBody.replace(regex, String(value || ""));
      }

      if (!aiInstructions) {
        // No AI — just use interpolated template
        results.push({ lead, subject: baseSubject, body: baseBody, personalized: false });
        continue;
      }

      try {
        const prompt = `You are an elite SDR. Personalize this cold email for maximum response rate. Return ONLY valid JSON: {"subject":"...","body":"..."}

Lead data: ${JSON.stringify(lead)}
Base subject: ${baseSubject}
Base body: ${baseBody}
Instructions: ${aiInstructions}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: prompt }],
            tools: [
              {
                type: "function",
                function: {
                  name: "personalized_email",
                  description: "Return a personalized email subject and body",
                  parameters: {
                    type: "object",
                    properties: {
                      subject: { type: "string", description: "Personalized email subject line" },
                      body: { type: "string", description: "Personalized email body text" },
                    },
                    required: ["subject", "body"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "personalized_email" } },
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429 || status === 402) {
            // Rate limited or out of credits — stop AI, use fallback for remaining
            console.warn(`AI rate limited (${status}), falling back to template`);
            results.push({ lead, subject: baseSubject, body: baseBody, personalized: false });
            continue;
          }
          throw new Error(`AI gateway error: ${status}`);
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          results.push({
            lead,
            subject: parsed.subject || baseSubject,
            body: parsed.body || baseBody,
            personalized: true,
          });
        } else {
          results.push({ lead, subject: baseSubject, body: baseBody, personalized: false });
        }
      } catch (aiErr: any) {
        console.error(`AI personalization failed for ${lead.email}:`, aiErr.message);
        results.push({ lead, subject: baseSubject, body: baseBody, personalized: false });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("AI personalize error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
