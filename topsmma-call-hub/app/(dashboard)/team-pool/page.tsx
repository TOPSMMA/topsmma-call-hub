import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

async function assignLead(formData: FormData) {
  "use server";
  const leadId = String(formData.get("leadId") || "");
  const repId = String(formData.get("repId") || "");
  if (!leadId || !repId) return;
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ assigned_rep_id: repId })
    .eq("id", leadId)
    .is("assigned_rep_id", null);
  revalidatePath("/team-pool");
}

async function assignBulk(formData: FormData) {
  "use server";
  const repId = String(formData.get("repId") || "");
  const tier = String(formData.get("tier") || "any");
  const count = Math.max(1, Math.min(200, Number(formData.get("count")) || 0));
  if (!repId || !count) return;

  const supabase = await createClient();
  const base = supabase
    .from("leads")
    .select("id")
    .is("assigned_rep_id", null)
    .order("tier", { ascending: true })
    .order("score", { ascending: false })
    .limit(count);

  const { data: targets } = tier === "any" ? await base : await base.eq("tier", tier);
  const ids = (targets ?? []).map((l) => l.id);
  if (ids.length === 0) return;

  await supabase.from("leads").update({ assigned_rep_id: repId }).in("id", ids);
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

  const { data: poolLeads } = await supabase
    .from("leads")
    .select("id, lead_number, company_name, tier, score")
    .is("assigned_rep_id", null)
    .order("tier", { ascending: true })
    .order("score", { ascending: false })
    .limit(100);

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

  const leadsToShow = poolLeads ?? [];

  return (
    <div className="p-7 flex flex-col gap-5">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Team &amp; pool</h1>
          <div className="text-muted text-[13px] mt-1">Allocation, quotas and the unassigned pool</div>
        </div>
      </div>

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

      {reps.length > 0 && poolTotal > 0 && (
        <div className="bg-card border border-line rounded-xl p-4.5 flex flex-col gap-3">
          <div className="font-bold text-sm">Bulk assign from pool</div>
          <form action={assignBulk} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Assign to</label>
              <select
                name="repId"
                required
                defaultValue=""
                className="bg-cardhover border border-line rounded-lg px-2.5 py-1.5 text-[12.5px]"
              >
                <option value="" disabled>
                  Choose rep&hellip;
                </option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Tier</label>
              <select
                name="tier"
                defaultValue="any"
                className="bg-cardhover border border-line rounded-lg px-2.5 py-1.5 text-[12.5px]"
              >
                <option value="any">Any tier</option>
                {TIERS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.key} &middot; {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">How many</label>
              <input
                type="number"
                name="count"
                min={1}
                max={200}
                defaultValue={10}
                className="w-20 bg-cardhover border border-line rounded-lg px-2.5 py-1.5 text-[12.5px]"
              />
            </div>
            <button
              type="submit"
              className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2"
            >
              Assign
            </button>
          </form>
          <div className="text-[11px] text-dim">
            Pulls the highest scoring leads in the chosen tier first, best leads going out first.
          </div>
        </div>
      )}

      <div className="bg-card border border-line rounded-xl overflow-hidden">
        <div className="px-4.5 py-3 border-b border-line font-bold text-sm">
          Unassigned leads
          {poolTotal > leadsToShow.length && (
            <span className="text-dim font-normal"> &middot; showing {leadsToShow.length} of {poolTotal}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-dim border-b border-line">
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Lead</th>
                <th className="px-4 py-2.5 font-semibold">Company</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Tier</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Score</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Assign to</th>
              </tr>
            </thead>
            <tbody>
              {leadsToShow.map((lead) => (
                <tr key={lead.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-dim whitespace-nowrap">{lead.lead_number}</td>
                  <td className="px-4 py-2.5 font-semibold">{lead.company_name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {lead.tier && (
                      <span className="bg-accent/10 text-accentlight text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {lead.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{lead.score ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <form action={assignLead} className="flex items-center gap-2 whitespace-nowrap">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <select
                        name="repId"
                        required
                        defaultValue=""
                        className="bg-cardhover border border-line rounded-lg px-2 py-1 text-[12px]"
                      >
                        <option value="" disabled>
                          Choose&hellip;
                        </option>
                        {reps.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.full_name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-accentlight font-bold text-[12px]">
                        Assign
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {leadsToShow.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-dim text-center">
                    Pool is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
