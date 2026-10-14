import { createClient } from "@/lib/supabase/server";
import TasksView from "@/components/TasksView";

export default async function TasksPage() {
    const supabase = await createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();
  
    const { data: tasks } = await supabase
          .from("tasks")
          .select("*, leads(company_name)")
          .eq("rep_id", user!.id)
          .order("due_at", { ascending: true, nullsFirst: false });
  
    const { data: leads } = await supabase
          .from("leads")
          .select("id, company_name")
          .eq("assigned_rep_id", user!.id)
          .order("company_name");
  
    return <TasksView initialTasks={tasks ?? []} leads={leads ?? []} userId={user!.id} />;
}
