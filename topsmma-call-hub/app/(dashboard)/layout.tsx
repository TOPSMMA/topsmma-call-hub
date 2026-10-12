import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const leadsQuery = supabase.from("leads").select("id", { count: "exact", head: true });
  const { count: totalLeads } = isAdmin
    ? await leadsQuery
    : await leadsQuery.or(`assigned_rep_id.eq.${user.id},assigned_rep_id.is.null`);

  const dueQuery = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .lte("next_followup_at", new Date().toISOString());
  const { count: dueCount } = isAdmin
    ? await dueQuery
    : await dueQuery.eq("assigned_rep_id", user.id);

  return (
    <div className="min-h-screen flex flex-wrap bg-base text-ink">
      <Sidebar
        fullName={profile?.full_name ?? user.email ?? "You"}
        dueCount={dueCount ?? 0}
        totalLeads={totalLeads ?? 0}
      />
      <div className="flex-[999_1_640px] min-w-0">{children}</div>
    </div>
  );
}
