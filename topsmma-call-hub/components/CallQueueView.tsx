"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import AddLeadForm from "@/components/AddLeadForm";

type CallQueueViewProps = {
  initialLeads: Lead[];
  userId: string;
  stats: { callsToday: number; connectsToday: number; meetings7d: number };
};

function isDue(lead: Lead) {
  return !!lead.next_followup_at && new Date(lead.next_followup_at) <= new Date();
}

function isUkOpenNow() {
  const hour = new Date().getUTCHours(); // close enough for GMT/BST display purposes
  return hour >= 9 && hour < 18;
}

export default function CallQueueView({ initialLeads, userId, stats }: CallQueueViewProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(initialLeads[0]?.id ?? null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [logging, setLogging] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const selectedLead = leads.find((l) => l.id === selectedId) ?? leads[0] ?? null;
  const dueCount = leads.filter(isDue).length;
  const upNext = selectedLead ? leads.filter((l) => l.id !== selectedLead.id) : [];
  const open = isUkOpenNow();

  async function handleStatusChange(status: LeadStatus) {
    if (!selectedLead) return;
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === selectedLead.id ? { ...l, status } : l)));
    const { error } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", selectedLead.id);
    if (error) setLeads(prev);
  }

  async function handleLogCall(outcome: "Connected" | "Voicemail" | "No Answer") {
    if (!selectedLead) return;
    setLogging(true);
    const nowIso = new Date().toISOString();

    await supabase.from("call_logs").insert({
      lead_id: selectedLead.id,
      rep_id: userId,
      outcome,
      led_to_meeting: false,
    });

    await supabase.from("leads").update({ last_called_at: nowIso }).eq("id", selectedLead.id);

    setLeads((cur) =>
      cur.map((l) => (l.id === selectedLead.id ? { ...l, last_called_at: nowIso } : l))
    );
    setLogging(false);
  }

  function handleLeadAdded(lead: Lead) {
    setLeads((cur) => [lead, ...cur]);
    setSelectedId(lead.id);
    setShowAddForm(false);
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Call queue</h1>
          <div className="text-muted text-[13px] mt-1">
            Who to call next, ranked by call-backs, local time and tier
          </div>
        </div>
        <div className="flex gap-2.5 items-center">
          <input
            placeholder="Search LEAD-ID, clinic, decision maker"
            className="w-64 bg-card border border-line rounded-lg px-3 py-2 text-[12.5px] outline-none focus:border-accent"
          />
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2"
          >
            + Add lead
          </button>
        </div>
      </div>

      {showAddForm && (
        <AddLeadForm userId={userId} onAdded={handleLeadAdded} onClose={() => setShowAddForm(false)} />
      )}

      <div className="bg-card border border-line rounded-xl px-4.5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${open ? "bg-good" : "bg-dim"}`} />
          <div>
            <div className="font-bold text-sm">UK call window &middot; 09:00&ndash;18:00</div>
            <div className="text-xs text-muted mt-0.5">{open ? "Open now" : "Closed for the day"}</div>
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-lg font-extrabold">{leads.length}</div>
            <div className="text-[11px] text-muted">in your queue</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-bad">{dueCount}</div>
            <div className="text-[11px] text-muted">due now</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-line rounded-xl p-3.5">
          <div className="text-[11px] text-muted">Calls today</div>
          <div className="text-xl font-extrabold mt-1">{stats.callsToday}</div>
        </div>
        <div className="bg-card border border-line rounded-xl p-3.5">
          <div className="text-[11px] text-muted">Conversations today</div>
          <div className="text-xl font-extrabold mt-1">{stats.connectsToday}</div>
        </div>
        <div className="bg-card border border-line rounded-xl p-3.5">
          <div className="text-[11px] text-muted">Meetings, last 7 days</div>
          <div className="text-xl font-extrabold mt-1 text-good">{stats.meetings7d}</div>
        </div>
      </div>

      {!selectedLead ? (
        <div className="bg-card border border-dashed border-line rounded-xl p-10 text-center">
          <div className="font-bold text-sm mb-1.5">Your queue is empty</div>
          <div className="text-muted text-xs mb-4">
            Add your first lead to start building your call queue.
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-xs rounded-lg px-4 py-2"
          >
            + Add lead
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-5">
          {/* Lead detail */}
          <div className="flex-[999_1_560px] min-w-0 bg-card border border-line rounded-2xl p-6">
            <div className="flex justify-between items-start flex-wrap gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted">{selectedLead.lead_number}</span>
                {selectedLead.score != null && (
                  <span className="bg-line text-[#AEB6C2] text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {selectedLead.score}
                  </span>
                )}
                {selectedLead.tier && (
                  <span className="bg-accent/10 text-accentlight text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {selectedLead.tier} &middot; {selectedLead.tier_label}
                  </span>
                )}
              </div>
              <div className="text-xs text-dim">
                {selectedLead.last_called_at
                  ? `Last called ${new Date(selectedLead.last_called_at).toLocaleString()}`
                  : "Never called"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {LEAD_STATUSES.map((status) => {
                const active = status === selectedLead.status;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-full border ${
                      active
                        ? "bg-accent border-accent text-white"
                        : "bg-cardhover border-line text-[#AEB6C2]"
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>

            <h2 className="text-[28px] font-extrabold mt-4 mb-1">{selectedLead.company_name}</h2>
            <div className="text-[13px] text-muted">
              {[selectedLead.contact_name, selectedLead.contact_role, selectedLead.source]
                .filter(Boolean)
                .join(" · ")}
            </div>

            {selectedLead.phone && (
              <div className="flex items-center gap-3 flex-wrap mt-4">
                <div className="text-2xl font-extrabold tracking-wide">{selectedLead.phone}</div>
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-xs rounded-lg px-4 py-2"
                >
                  Call
                </a>
                {selectedLead.email && (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="bg-cardhover border border-line text-ink font-semibold text-xs rounded-lg px-3 py-2"
                  >
                    Email
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                disabled={logging}
                onClick={() => handleLogCall("Connected")}
                className="bg-good/10 text-good border border-good/30 text-xs font-bold rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Log: Connected
              </button>
              <button
                disabled={logging}
                onClick={() => handleLogCall("Voicemail")}
                className="bg-warn/10 text-warn border border-warn/30 text-xs font-bold rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Log: Voicemail
              </button>
              <button
                disabled={logging}
                onClick={() => handleLogCall("No Answer")}
                className="bg-line/60 text-muted border border-line text-xs font-bold rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Log: No answer
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-5 pt-4.5 border-t border-line">
              <div>
                <div className="text-[10.5px] text-dim uppercase tracking-wide">Region</div>
                <div className="text-[13px] mt-1">{selectedLead.region || "—"}</div>
              </div>
              <div>
                <div className="text-[10.5px] text-dim uppercase tracking-wide">Website</div>
                <div className="text-[13px] mt-1">
                  {selectedLead.website ? (
                    <a href={`https://${selectedLead.website}`} target="_blank" rel="noreferrer">
                      {selectedLead.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-dim uppercase tracking-wide">Google</div>
                <div className="text-[13px] mt-1">
                  {selectedLead.google_rating
                    ? `★ ${selectedLead.google_rating} · ${selectedLead.google_reviews ?? 0} reviews`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-dim uppercase tracking-wide">Signals</div>
                <div className="text-[13px] mt-1 text-dim">{selectedLead.signals || "—"}</div>
              </div>
            </div>

            {selectedLead.research_notes && (
              <div className="mt-4.5">
                <div className="text-[10.5px] text-dim uppercase tracking-wide mb-1.5">Research</div>
                <div className="text-[13px] text-[#C7CDD6] leading-relaxed">
                  {selectedLead.research_notes}
                </div>
              </div>
            )}
          </div>

          {/* Up next */}
          <div className="flex-none w-[300px] min-w-[260px] bg-card border border-line rounded-2xl p-4.5 flex flex-col gap-3 h-fit">
            <div className="flex justify-between items-center">
              <div className="font-bold text-sm">Up next</div>
              <div className="text-[11.5px] text-dim">{upNext.length} in queue</div>
            </div>
            <div className="flex flex-col">
              {upNext.length === 0 && (
                <div className="text-xs text-dim py-2">Nothing else queued right now.</div>
              )}
              {upNext.map((lead, i) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className="text-left bg-transparent border-b border-panel py-2.5 px-1.5 flex gap-2.5 items-start"
                >
                  <div className="text-[11px] text-dim w-3.5 pt-0.5">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{lead.company_name}</div>
                    <div className="text-[11.5px] text-muted mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-good inline-block" />
                      {lead.region || lead.status}
                    </div>
                  </div>
                  {isDue(lead) && (
                    <span className="bg-bad/15 text-bad text-[10.5px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Due
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
