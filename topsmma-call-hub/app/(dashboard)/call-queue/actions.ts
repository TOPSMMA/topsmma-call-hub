"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAiBrief } from "@/lib/ai-brief";

// Called from the Call queue when a rep clicks "Generate AI brief" (or
// "Retry") on a lead that doesn't have one yet. Flips the status to
// pending under the rep's own session (covered by the existing
// "update own assigned leads" policy), then does the actual research
// and writing in the background with the service role client, since
// that step needs to keep running after this request has returned.
export async function requestAiBrief(leadId: string) {
  const supabase = await createClient();
  await supabase.from("leads").update({ ai_brief_status: "pending" }).eq("id", leadId);
  after(() => generateAiBrief(leadId));
}
