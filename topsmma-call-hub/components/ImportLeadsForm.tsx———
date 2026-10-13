"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseLeadsCsv, CSV_TEMPLATE, type ParsedLeadRow } from "@/lib/csv";

type Rep = { id: string; full_name: string };

type ImportLeadsFormProps = {
reps: Rep[];
onClose: () => void;
onImported: () => void;
};

const CHUNK_SIZE = 300;

export default function ImportLeadsForm({ reps, onClose, onImported }: ImportLeadsFormProps) {
const fileInputRef = useRef<HTMLInputElement>(null);
const [fileName, setFileName] = useState<string | null>(null);
const [rows, setRows] = useState<ParsedLeadRow[]>([]);
const [skipped, setSkipped] = useState<{ line: number; reason: string }[]>([]);
const [assignTo, setAssignTo] = useState<string>(""); // "" = unassigned pool
const [importing, setImporting] = useState(false);
const [progress, setProgress] = useState(0);
const [error, setError] = useState<string | null>(null);
const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

function handleFile(file: File) {
setError(null);
setResult(null);
setFileName(file.name);
const reader = new FileReader();
reader.onload = () => {
const text = String(reader.result ?? "");
const parsed = parseLeadsCsv(text);
if (parsed.rows.length === 0 && parsed.skipped.length === 0) {
setError("Could not find any rows in that file. Check it's a CSV with a header row.");
setRows([]);
setSkipped([]);
return;
}
setRows(parsed.rows);
setSkipped(parsed.skipped);
};
reader.onerror = () => setError("Could not read that file.");
reader.readAsText(file);
}

function downloadTemplate() {
const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "leads-template.csv";
a.click();
URL.revokeObjectURL(url);
}

async function handleImport() {
if (rows.length === 0) return;
setImporting(true);
setProgress(0);
setError(null);
setResult(null);

const supabase = createClient();
let imported = 0;
let failed = 0;

for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
const chunk = rows.slice(i, i + CHUNK_SIZE).map((r) => ({
company_name: r.company_name,
contact_name: r.contact_name,
contact_role: r.contact_role,
phone: r.phone,
email: r.email,
website: r.website,
region: r.region,
tier: r.tier,
tier_label: r.tier_label,
source: r.source,
google_rating: r.google_rating,
google_reviews: r.google_reviews,
signals: r.signals,
research_notes: r.research_notes,
status: "Uncalled" as const,
assigned_rep_id: assignTo || null,
}));

const { error: insertError, data } = await supabase.from("leads").insert(chunk).select("id");

if (insertError) {
failed += chunk.length;
setError(insertError.message);
} else {
imported += data?.length ?? chunk.length;
}

setProgress(Math.min(i + CHUNK_SIZE, rows.length));
}

setImporting(false);
setResult({ imported, failed });
if (imported > 0) onImported();
}

function reset() {
setFileName(null);
setRows([]);
setSkipped([]);
setResult(null);
setError(null);
if (fileInputRef.current) fileInputRef.current.value = "";
}

return (
<div className="bg-card border border-line rounded-xl p-4 flex flex-col gap-3">
<div className="flex items-center justify-between">
<div className="text-sm font-bold">Bulk import leads from CSV</div>
<button type="button" onClick={onClose} className="text-xs text-dim hover:text-ink">
Close
</button>
</div>

{rows.length === 0 && (
<>
<div className="text-xs text-muted">
Upload a CSV with a header row. Recognised columns: company_name, contact_name,
contact_role, phone, email, website, region, tier (T1/T2/T3), source, notes. Only
company_name is required, everything else is optional.
</div>
<div className="flex items-center gap-3">
<input
ref={fileInputRef}
type="file"
accept=".csv,text/csv"
onChange={(e) => {
const file = e.target.files?.[0];
if (file) handleFile(file);
}}
className="text-xs text-dim file:mr-3 file:bg-cardhover file:border file:border-line file:rounded-lg file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink file:cursor-pointer"
/>
<button
type="button"
onClick={downloadTemplate}
className="text-xs text-accentlight whitespace-nowrap"
>
Download template
</button>
</div>
{error && <div className="text-xs text-bad">{error}</div>}
</>
)}

      {rows.length > 0 && !result && (
        <>
          <div className="text-xs text-muted">
            {fileName} &middot; <span className="text-ink font-semibold">{rows.length}</span>{" "}
            lead{rows.length === 1 ? "" : "s"} ready to import
            {skipped.length > 0 && (
              <>
                {" "}
                &middot;{" "}
                <span className="text-bad font-semibold">
                  {skipped.length} row{skipped.length === 1 ? "" : "s"} skipped
                </span>{" "}
                (missing company name)
              </>
            )}
          </div>

          <div className="border border-line rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-cardhover text-dim text-left">
                  <th className="px-2.5 py-1.5 font-semibold">Company</th>
                  <th className="px-2.5 py-1.5 font-semibold">Contact</th>
                  <th className="px-2.5 py-1.5 font-semibold">Phone</th>
                  <th className="px-2.5 py-1.5 font-semibold">Region</th>
                  <th className="px-2.5 py-1.5 font-semibold">Tier</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-2.5 py-1.5">{r.company_name}</td>
                    <td className="px-2.5 py-1.5 text-dim">{r.contact_name || "—"}</td>
                    <td className="px-2.5 py-1.5 text-dim">{r.phone || "—"}</td>
                    <td className="px-2.5 py-1.5 text-dim">{r.region || "—"}</td>
                    <td className="px-2.5 py-1.5 text-dim">{r.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && (
              <div className="px-2.5 py-1.5 text-[11px] text-dim bg-cardhover border-t border-line">
                + {rows.length - 5} more
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <label className="text-xs text-dim whitespace-nowrap">Assign all to</label>
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="bg-panel border border-line rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="">Unassigned pool</option>
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="text-xs text-bad">{error}</div>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="bg-accent hover:bg-accentlight transition-colors text-white font-semibold text-xs rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {importing ? `Importing ${progress}/${rows.length}...` : `Import ${rows.length} leads`}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={importing}
              className="text-xs text-dim hover:text-ink disabled:opacity-50"
            >
              Choose a different file
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <div className="text-xs">
            <span className="text-good font-semibold">{result.imported} imported</span>
            {result.failed > 0 && (
              <>
                {" "}
                &middot; <span className="text-bad font-semibold">{result.failed} failed</span>
              </>
            )}
            {skipped.length > 0 && (
              <>
                {" "}
                &middot;{" "}
                <span className="text-dim">
                  {skipped.length} skipped for missing company name
                </span>
              </>
            )}
          </div>
          {error && <div className="text-xs text-bad">{error}</div>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-accentlight"
            >
              Import another file
            </button>
            <button type="button" onClick={onClose} className="text-xs text-dim hover:text-ink">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
