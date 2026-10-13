import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import ImportLeadsSection from "@/components/ImportLeadsSection";

const TIERS: { key: "T1" | "T2" | "T3"; label: string }[] = [
  { key: "T1", label: "Whale" },
  { key: "T2", label: "Bread & Butter" },
  { key: "T3", label: "Mass Market" },
];

async function returnUncalled(formData: FormData) {
  "use server";
  const repId = String(formData.get("repId") || "");
  if (!repId) return;
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ assigned_rep_id: null })
    .eq("assigned_rep_id", repId)
    .eq("status", "Uncalled");
  revalidatePath("/team-pool");
}

export default async function TeamPoolPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, active")
    .order("full_name");

  const { data: pool } = await supabase
    .from("leads")
    .select("tier")
    .is("assigned_rep_id", null);

  const poolTotal = pool?.length ?? 0;
  const poolByTier = Object.fromEntries(
    TIERS.map((t) => [t.key, pool?.filter((l) => l.tier === t.key).length ?? 0])
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const reps = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { count: total } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_rep_id", p.id);

      const { count: remaining } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_rep_id", p.id)
        .eq("status", "Uncalled");

      const { count: calls7d } = await supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("rep_id", p.id)
        .gte("called_at", sevenDaysAgo);

      const { count: meetings7d } = await supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("rep_id", p.id)
        .eq("led_to_meeting", true)
        .gte("called_at", sevenDaysAgo);

      return { ...p, total: total ?? 0, remaining: remaining ?? 0, calls7d: calls7d ?? 0, meetings7d: meetings7d ?? 0 };
    })
  );

  return (
    <div className="p-7 flex flex-col gap-5">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Team &amp; pool</h1>
          <div className="text-muted text-[13px] mt-1">Allocation, quotas and the unassigned pool</div>
        </div>
      </div>

      <ImportLeadsSection reps={(profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))} />

      <div className="bg-card border border-line rounded-xl px-5 py-4.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10.5px] text-dim uppercase tracking-wide">Unassigned pool</div>
          <div className="text-3xl font-extrabold mt-1">{poolTotal}</div>
        </div>
        <div className="flex gap-7 flex-wrap">
          {TIERS.map((t) => (
            <div key={t.key}>
              <div className="text-[11px] text-muted">
                Tier {t.key.slice(1)} &middot; {t.label}
              </div>
              <div className="text-lg font-bold mt-0.5">{poolByTier[t.key]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {reps.map((rep) => {
          const pct = rep.total > 0 ? Math.round(((rep.total - rep.remaining) / rep.total) * 100) : 0;
          return (
            <div key={rep.id} className="bg-card border border-line rounded-xl p-4.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center text-[13px] font-bold">
                  {rep.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13.5px] font-bold">{rep.full_name}</div>
                  <div className="text-[11.5px] text-dim">
                    {rep.total} total &middot; {rep.remaining} remaining to call
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-line rounded-full mt-3.5 overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-3.5 gap-2">
                <div>
                  <div className="text-base font-extrabold">{rep.calls7d}</div>
                  <div className="text-[10.5px] text-muted">calls 7d</div>
                </div>
                <div>
                  <div className="text-base font-extrabold text-good">{rep.meetings7d}</div>
                  <div className="text-[10.5px] text-muted">meetings 7d</div>
                </div>
              </div>
              {rep.total > 0 && (
                <form action={returnUncalled} className="mt-3">
                  <input type="hidden" name="repId" value={rep.id} />
                  <button type="submit" className="text-[12px] text-accentlight">
                    &#8634; Return uncalled
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {reps.length === 0 && (
          <div className="text-muted text-sm">No teammates yet.</div>
        )}
      </div>
    </div>
  );
}
