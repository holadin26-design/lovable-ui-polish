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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lead_ids, offer_description } = await req.json();
    if (!lead_ids || !Array.isArray(lead_ids)) {
      return new Response(JSON.stringify({ error: 'lead_ids array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('id', lead_ids)
      .eq('user_id', user.id);

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: 'No leads found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const lead of leads) {
      const customFields = lead.custom_fields ? JSON.stringify(lead.custom_fields) : 'none';
      
      const systemPrompt = `You are a B2B sales research analyst. Given lead information, produce research for cold email outreach. Return a JSON object with exactly these keys:
- "summary": 2-3 sentence company/role summary
- "pain_points": array of 2 top pain points relevant to the offer
- "relevancy_score": integer 1-10 scoring fit against the offer
- "personalized_line": a personalized opening line for cold email
- "hook_angle": the best angle/hook for outreach

Be specific, concise, and actionable. Base analysis on the data provided.`;

      const userPrompt = `Lead data:
- Name: ${lead.name || 'Unknown'}
- Email: ${lead.email}
- Company: ${lead.company || 'Unknown'}
- Custom fields: ${customFields}

${offer_description ? `Offer: ${offer_description}` : 'No specific offer defined - provide general B2B outreach research.'}

Return ONLY valid JSON, no markdown.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
              status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw new Error(`AI error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        // Parse JSON from response (handle markdown code blocks)
        let parsed;
        try {
          const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          parsed = JSON.parse(jsonStr);
        } catch {
          parsed = { summary: content, pain_points: [], relevancy_score: 5, personalized_line: '', hook_angle: '' };
        }

        // Update lead with AI research
        await supabase.from('leads').update({
          ai_summary: parsed.summary,
          ai_pain_points: parsed.pain_points || [],
          ai_relevancy_score: parsed.relevancy_score,
          ai_personalized_line: parsed.personalized_line,
          ai_researched_at: new Date().toISOString(),
        }).eq('id', lead.id);

        results.push({ lead_id: lead.id, email: lead.email, ...parsed });
      } catch (leadError: unknown) {
        const msg = leadError instanceof Error ? leadError.message : 'Unknown error';
        results.push({ lead_id: lead.id, email: lead.email, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('AI research error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
