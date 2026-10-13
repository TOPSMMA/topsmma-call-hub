import { createAdminClient } from "@/lib/supabase/admin";

// Pick the model via env var rather than hardcoding one here, since
// Anthropic's current model names change over time. Check
// https://docs.claude.com/en/docs/about-claude/models for the current
// slug (a fast, inexpensive model is plenty for this).
const MODEL = process.env.ANTHROPIC_MODEL || "";

type LeadForBrief = {
  company_name: string;
  contact_name: string | null;
  contact_role: string | null;
  region: string | null;
  tier: string | null;
  tier_label: string | null;
  source: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  signals: string | null;
};

type BriefResult = {
  general_info: string;
  pain_points: string[];
  call_script: string;
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Best-effort fetch of a prospect's own website so the brief is
// grounded in something real rather than a generic guess. Any failure
// here (dead site, timeout, blocked) just means we fall back to the
// lead's existing fields, it never blocks the brief entirely.
async function fetchSiteText(website: string): Promise<string | null> {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    return text.length > 40 ? text.slice(0, 6000) : null;
  } catch {
    return null;
  }
}

async function callClaude(prompt: string): Promise<BriefResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !MODEL) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed.general_info || !parsed.call_script) return null;
    return {
      general_info: String(parsed.general_info),
      pain_points: Array.isArray(parsed.pain_points) ? parsed.pain_points.map(String) : [],
      call_script: String(parsed.call_script),
    };
  } catch {
    return null;
  }
}

function buildPrompt(lead: LeadForBrief, siteText: string | null) {
  return `You are helping a UK marketing agency's sales rep prepare to cold call a prospect clinic.

Prospect details:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name || "unknown"} (${lead.contact_role || "role unknown"})
- Region: ${lead.region || "unknown"}
- Tier: ${lead.tier || "unknown"} (${lead.tier_label || ""})
- Source: ${lead.source || "unknown"}
- Google rating: ${lead.google_rating ?? "unknown"} from ${lead.google_reviews ?? 0} reviews
- Existing notes: ${lead.signals || "none"}
${
  siteText
    ? `\nText extracted from their website (may be incomplete or messy):\n"""${siteText}"""`
    : "\nNo website content could be retrieved. Work only from the details above, and do not invent specifics about their site, services or reviews."
}

Write a short, honest brief a rep can skim in under a minute before dialling. Never invent facts that aren't given above or in the website text. Return ONLY a JSON object, no other text, with exactly these keys:
{
  "general_info": "2-3 sentences on what this business appears to be and anything notably relevant",
  "pain_points": ["2 to 4 short, plausible marketing or operational pain points, each one sentence"],
  "call_script": "A natural-sounding cold call opening, 3 to 5 sentences, referencing something specific and real from the details above rather than generic flattery"
}`;
}

// Generates (or regenerates) the AI brief for one lead and writes the
// result straight to the database. Designed to be called in the
// background, after a request has already responded (via Next's
// `after()`), so it uses the service role client rather than a rep's
// own session.
export async function generateAiBrief(leadId: string) {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select(
      "company_name, contact_name, contact_role, region, tier, tier_label, source, website, google_rating, google_reviews, signals"
    )
    .eq("id", leadId)
    .single();

  if (!lead) return;

  const siteText = lead.website ? await fetchSiteText(lead.website) : null;
  const prompt = buildPrompt(lead, siteText);
  const result = await callClaude(prompt);

  if (!result) {
    await supabase.from("leads").update({ ai_brief_status: "failed" }).eq("id", leadId);
    return;
  }

  await supabase
    .from("leads")
    .update({
      ai_brief: result.general_info,
      ai_pain_points: result.pain_points.join("\n"),
      ai_call_script: result.call_script,
      ai_brief_status: "ready",
      ai_brief_generated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
}
