"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";

type PipelineViewProps = {
  initialLeads: Lead[];
  userId: string;
};

type PendingClose = { leadId: string; status: "Closed Won" | "Closed Lost" };

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default function PipelineView({ initialLeads, userId }: PipelineViewProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);
  const [dealValueInput, setDealValueInput] = useState("");
  const [lostReasonInput, setLostReasonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const columns = useMemo(
    () =>
      LEAD_STATUSES.map((status) => ({
        status,
        leads: leads.filter((l) => l.status === status),
      })),
    [leads]
  );

  const pendingLead = pendingClose ? leads.find((l) => l.id === pendingClose.leadId) ?? null : null;

  async function commitMove(leadId: string, status: LeadStatus) {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === leadId ? { ...l, status } : l)));
    const { error } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) setLeads(prev);
  }

  function requestMove(leadId: string, status: LeadStatus) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;

    if (status === "Closed Won" || status === "Closed Lost") {
      setSaveError(null);
      setDealValueInput(lead.deal_value != null ? String(lead.deal_value) : "");
      setLostReasonInput(lead.lost_reason ?? "");
      setPendingClose({ leadId, status });
      return;
    }

    commitMove(leadId, status);
  }

  async function confirmClose() {
    if (!pendingClose || !pendingLead) return;
    setSaving(true);
    setSaveError(null);
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    if (pendingClose.status === "Closed Won") {
      const value = Number(dealValueInput) || 0;
      const { error } = await supabase
        .from("leads")
        .update({
          status: "Closed Won",
          deal_value: value,
          close_date: today,
          updated_at: nowIso,
        })
        .eq("id", pendingClose.leadId);

      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }

      // Also log it as closed revenue so it shows up on Reports. A rep is
      // allowed to insert their own closed deals (see schema.sql), so this
      // runs under the rep's own session rather than needing the service
      // role. If this second write fails, the lead is still correctly
      // marked Closed Won; it just won't show on Reports yet.
      await supabase.from("revenue_closed_won").insert({
        lead_id: pendingClose.leadId,
        rep_id: userId,
        close_date: today,
        revenue_amount: value,
      });

      setLeads((cur) =>
        cur.map((l) =>
          l.id === pendingClose.leadId
            ? { ...l, status: "Closed Won", deal_value: value, close_date: today }
            : l
        )
      );
    } else {
      const { error } = await supabase
        .from("leads")
        .update({
          status: "Closed Lost",
          lost_reason: lostReasonInput || null,
          updated_at: nowIso,
        })
        .eq("id", pendingClose.leadId);

      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }

      setLeads((cur) =>
        cur.map((l) =>
          l.id === pendingClose.leadId
            ? { ...l, status: "Closed Lost", lost_reason: lostReasonInput || null }
            : l
        )
      );
    }

    setSaving(false);
    setPendingClose(null);
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold m-0">Pipeline</h1>
        <div className="text-muted text-[13px] mt-1">
          Your leads by stage. Drag a card to move it, or use the dropdown on the card.
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => {
          const total = col.leads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0);
          return (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData("text/plain");
                if (leadId) requestMove(leadId, col.status);
                setDraggingId(null);
              }}
              className="flex-none w-[270px] bg-panel border border-line rounded-xl p-3 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between px-0.5">
                <div className="font-bold text-[12.5px]">{col.status}</div>
                <div className="text-[11px] text-dim">{col.leads.length}</div>
              </div>
              {total > 0 && (
                <div className="text-[11px] text-good font-semibold px-0.5">{currency.format(total)}</div>
              )}
              <div className="flex flex-col gap-2 min-h-[48px]">
                {col.leads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`bg-card border border-line rounded-lg p-3 flex flex-col gap-1.5 cursor-grab ${
                      draggingId === lead.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-semibold leading-snug">{lead.company_name}</div>
                      {lead.tier && (
                        <span className="bg-accent/10 text-accentlight text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {lead.tier}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-dim">{lead.lead_number}</div>
                    {lead.deal_value != null && lead.deal_value > 0 && (
                      <div className="text-[12px] font-bold text-good">{currency.format(lead.deal_value)}</div>
                    )}
                    {col.status === "Closed Lost" && lead.lost_reason && (
                      <div className="text-[11px] text-dim italic">{lead.lost_reason}</div>
                    )}
                    <select
                      value={lead.status}
                      onChange={(e) => requestMove(lead.id, e.target.value as LeadStatus)}
                      className="mt-1 bg-cardhover border border-line rounded-md px-1.5 py-1 text-[11px]"
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {col.leads.length === 0 && (
                  <div className="text-[11px] text-dim italic px-1 py-2">Drop a lead here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingClose && pendingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-line rounded-xl p-5 w-full max-w-sm flex flex-col gap-3.5">
            <div>
              <div className="font-bold text-sm">
                {pendingClose.status === "Closed Won" ? "Mark as Closed Won" : "Mark as Closed Lost"}
              </div>
              <div className="text-[12.5px] text-muted mt-0.5">{pendingLead.company_name}</div>
            </div>

            {pendingClose.status === "Closed Won" ? (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted">Deal value (&pound;)</label>
                <input
                  type="number"
                  min={0}
                  value={dealValueInput}
                  onChange={(e) => setDealValueInput(e.target.value)}
                  autoFocus
                  className="bg-cardhover border border-line rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted">Reason (optional)</label>
                <input
                  type="text"
                  value={lostReasonInput}
                  onChange={(e) => setLostReasonInput(e.target.value)}
                  autoFocus
                  placeholder="Went with a competitor, budget, timing..."
                  className="bg-cardhover border border-line rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent"
                />
              </div>
            )}

            {saveError && <div className="text-[12px] text-bad">{saveError}</div>}

            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => setPendingClose(null)}
                disabled={saving}
                className="text-[12.5px] text-dim font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmClose}
                disabled={saving}
                className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
