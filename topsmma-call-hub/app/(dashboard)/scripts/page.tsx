import { createClient } from "@/lib/supabase/server";
import ScriptsView from "@/components/ScriptsView";

export default async function ScriptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user!.id)
  .single();

const { data: scripts } = await supabase
  .from("scripts")
  .select("*")
  .order("category", { ascending: true })
  .order("sort_order", { ascending: true });

return <ScriptsView initialScripts={scripts ?? []} isAdmin={profile?.role === "admin"} userId={user!.id} />;
}
