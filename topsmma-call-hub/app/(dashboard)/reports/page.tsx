import { createClient } from "@/lib/supabase/server";

type RepRow = { id: string; full_name: string };

type CallLogRow = {
  rep_id: string;
  called_at: string;
  outcome: "Connected" | "Voicemail" | "No Answer";
  led_to_meeting: boolean;
};

type RevenueRow = {
  rep_id: string;
  close_date: string;
  revenue_amount: number;
};

type Period = { key: string; label: string; since: Date };

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0); // close enough for GMT/BST reporting purposes
  return d;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const periods: Period[] = [
    { key: "today", label: "Today", since: startOfToday() },
    { key: "week", label: "Last 7 days", since: daysAgo(7) },
    { key: "month", label: "Last 30 days", since: daysAgo(30) },
  ];

  const earliestSince = periods[periods.length - 1].since;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("rep_id, called_at, outcome, led_to_meeting")
    .gte("called_at", earliestSince.toISOString());

  const { data: revenue } = await supabase
    .from("revenue_closed_won")
    .select("rep_id, close_date, revenue_amount")
    .gte("close_date", earliestSince.toISOString().slice(0, 10));

  const reps: RepRow[] = profiles ?? [];
  const logs: CallLogRow[] = callLogs ?? [];
  const deals: RevenueRow[] = revenue ?? [];

  function statsFor(since: Date, repId?: string) {
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const inWindow = logs.filter(
      (l) => l.called_at >= sinceIso && (!repId || l.rep_id === repId)
    );
    const dealsInWindow = deals.filter(
      (d) => d.close_date >= sinceDate && (!repId || d.rep_id === repId)
    );

    const calls = inWindow.length;
    const connects = inWindow.filter((l) => l.outcome === "Connected").length;
    const voicemails = inWindow.filter((l) => l.outcome === "Voicemail").length;
    const noAnswers = inWindow.filter((l) => l.outcome === "No Answer").length;
    const meetings = inWindow.filter((l) => l.led_to_meeting).length;
    const closedDeals = dealsInWindow.length;
    const revenueTotal = dealsInWindow.reduce(
      (sum, d) => sum + Number(d.revenue_amount),
      0
    );

    return { calls, connects, voicemails, noAnswers, meetings, closedDeals, revenueTotal };
  }

  return (
    <div className="p-7 flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-extrabold m-0">Reports</h1>
        <div className="text-muted text-[13px] mt-1">
          Team call activity and closed revenue, by day, week and month
        </div>
      </div>

      {periods.map((period) => {
        const team = statsFor(period.since);
        const connectRate = team.calls > 0 ? Math.round((team.connects / team.calls) * 100) : 0;

        return (
          <div key={period.key} className="flex flex-col gap-3.5">
            <div className="font-bold text-sm">{period.label}</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <StatCard label="Calls" value={team.calls} />
              <StatCard label="Connects" value={team.connects} accent="good" />
              <StatCard label="Connect rate" value={`${connectRate}%`} />
              <StatCard label="Voicemails" value={team.voicemails} accent="warn" />
              <StatCard label="No answer" value={team.noAnswers} />
              <StatCard label="Meetings" value={team.meetings} accent="good" />
              <StatCard
                label="Closed &middot; Revenue"
                value={`${team.closedDeals} · ${currency.format(team.revenueTotal)}`}
              />
            </div>

            <div className="bg-card border border-line rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-dim border-b border-line">
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Rep</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Calls</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Connects</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Voicemails</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">No answer</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Meetings</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Closed</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((rep) => {
                    const s = statsFor(period.since, rep.id);
                    return (
                      <tr key={rep.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{rep.full_name}</td>
                        <td className="px-4 py-2.5">{s.calls}</td>
                        <td className="px-4 py-2.5 text-good">{s.connects}</td>
                        <td className="px-4 py-2.5 text-warn">{s.voicemails}</td>
                        <td className="px-4 py-2.5 text-dim">{s.noAnswers}</td>
                        <td className="px-4 py-2.5 text-good">{s.meetings}</td>
                        <td className="px-4 py-2.5">{s.closedDeals}</td>
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                          {currency.format(s.revenueTotal)}
                        </td>
                      </tr>
                    );
                  })}
                  {reps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 text-dim text-center">
                        No teammates yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "good" | "warn" | "bad";
}) {
  const color =
    accent === "good" ? "text-good" : accent === "warn" ? "text-warn" : accent === "bad" ? "text-bad" : "";
  return (
    <div className="bg-card border border-line rounded-xl p-3.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`text-lg font-extrabold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
