"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";

type AddLeadFormProps = {
  userId: string;
  onAdded: (lead: Lead) => void;
  onClose: () => void;
};

export default function AddLeadForm({ userId, onAdded, onClose }: AddLeadFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [tier, setTier] = useState<"T1" | "T2" | "T3">("T2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const tierLabel = tier === "T1" ? "Whale" : tier === "T2" ? "Bread & Butter" : "Mass Market";

    const { data, error: insertError } = await supabase
      .from("leads")
      .insert({
        company_name: companyName.trim(),
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        region: region.trim() || null,
        tier,
        tier_label: tierLabel,
        status: "Uncalled",
        assigned_rep_id: userId,
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onAdded(data as Lead);
    setCompanyName("");
    setContactName("");
    setPhone("");
    setRegion("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-line rounded-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">Add a lead</div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-dim hover:text-ink"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Clinic / company name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="col-span-2 bg-panel border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          placeholder="Contact name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="bg-panel border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="bg-panel border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          placeholder="Region, e.g. Manchester, UK"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="bg-panel border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as "T1" | "T2" | "T3")}
          className="bg-panel border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="T1">T1 - Whale</option>
          <option value="T2">T2 - Bread &amp; Butter</option>
          <option value="T3">T3 - Mass Market</option>
        </select>
      </div>
      {error && <div className="text-xs text-bad">{error}</div>}
      <button
        type="submit"
        disabled={saving}
        className="self-start bg-accent hover:bg-accentlight transition-colors text-white font-semibold text-xs rounded-lg px-4 py-2 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save lead"}
      </button>
    </form>
  );
}
