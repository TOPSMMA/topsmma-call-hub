import { createClient } from "@/lib/supabase/server";
import CallQueueView from "@/components/CallQueueView";

export default async function CallQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("assigned_rep_id", user!.id)
    .order("last_called_at", { ascending: true, nullsFirst: true })
    .order("next_followup_at", { ascending: true, nullsFirst: false })
    .limit(100);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { count: callsToday } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("rep_id", user!.id)
    .gte("called_at", startOfToday.toISOString());

  const { count: connectsToday } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("rep_id", user!.id)
    .eq("outcome", "Connected")
    .gte("called_at", startOfToday.toISOString());

  const { count: meetings7d } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("rep_id", user!.id)
    .eq("led_to_meeting", true)
    .gte("called_at", sevenDaysAgo.toISOString());

  return (
    <CallQueueView
      initialLeads={leads ?? []}
      userId={user!.id}
      stats={{
        callsToday: callsToday ?? 0,
        connectsToday: connectsToday ?? 0,
        meetings7d: meetings7d ?? 0,
      }}
      reps={(profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
    />
  );
}
