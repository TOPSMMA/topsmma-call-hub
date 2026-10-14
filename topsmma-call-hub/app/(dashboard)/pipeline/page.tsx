import { createClient } from "@/lib/supabase/server";
import PipelineView from "@/components/PipelineView";

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("assigned_rep_id", user!.id)
    .order("score", { ascending: false });

  return <PipelineView initialLeads={leads ?? []} userId={user!.id} />;
}
