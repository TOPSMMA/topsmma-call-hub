"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SCRIPT_CATEGORIES, type Script, type ScriptCategory } from "@/lib/types";

type ScriptsViewProps = {
  initialScripts: Script[];
  isAdmin: boolean;
  userId: string;
};

type FormState = {
  title: string;
  category: ScriptCategory;
  body: string;
};

const emptyForm: FormState = { title: "", category: "Opening", body: "" };

export default function ScriptsView({ initialScripts, isAdmin, userId }: ScriptsViewProps) {
  const [scripts, setScripts] = useState<Script[]>(initialScripts);
  const [selectedId, setSelectedId] = useState<string | null>(initialScripts[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

const supabase = useMemo(() => createClient(), []);

const grouped = useMemo(() => {
  return SCRIPT_CATEGORIES.map((category) => ({
    category,
    items: scripts.filter((s) => s.category === category),
  })).filter((g) => g.items.length > 0);
}, [scripts]);

const selected = scripts.find((s) => s.id === selectedId) ?? null;

function openNewForm() {
  setEditingId(null);
  setForm(emptyForm);
  setError(null);
  setShowForm(true);
}

function openEditForm(script: Script) {
  setEditingId(script.id);
  setForm({ title: script.title, category: script.category, body: script.body });
  setError(null);
  setShowForm(true);
}

async function handleSave(e: React.FormEvent) {
  e.preventDefault();
  if (!form.title.trim() || !form.body.trim()) return;
  setSaving(true);
  setError(null);

  if (editingId) {
    const { data, error: updateError } = await supabase
    .from("scripts")
    .update({
      title: form.title.trim(),
      category: form.category,
      body: form.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editingId)
    .select("*")
    .single();

  if (updateError || !data) {
    setError(updateError?.message ?? "Could not save that script.");
    setSaving(false);
    return;
  }

  setScripts((cur) => cur.map((s) => (s.id === editingId ? data : s)));
  } else {
    const { data, error: insertError } = await supabase
    .from("scripts")
    .insert({
      title: form.title.trim(),
      category: form.category,
      body: form.body,
      created_by: userId,
    })
    .select("*")
    .single();

  if (insertError || !data) {
    setError(insertError?.message ?? "Could not add that script.");
    setSaving(false);
    return;
  }

  setScripts((cur) => [...cur, data]);
    setSelectedId(data.id);
  }

  setSaving(false);
  setShowForm(false);
}

async function deleteScript(scriptId: string) {
  const prev = scripts;
  setScripts((cur) => cur.filter((s) => s.id !== scriptId));
  if (selectedId === scriptId) setSelectedId(null);

  const { error: deleteError } = await supabase.from("scripts").delete().eq("id", scriptId);
  if (deleteError) setScripts(prev);
}

async function copyBody() {
  if (!selected) return;
  try {
    await navigator.clipboard.writeText(selected.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch {
    // Clipboard access can be blocked by the browser, fail quietly.
  }
}

return (
  <div className="p-7 flex flex-col gap-5 h-screen">
  <div className="flex items-start justify-between gap-3">
  <div>
  <h1 className="text-2xl font-extrabold m-0">Scripts</h1>
  <div className="text-muted text-[13px] mt-1">
  Shared talk tracks, openers and objection handling for the whole team.
  </div>
  </div>
    {isAdmin && (
    <button
      onClick={openNewForm}
      className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2 flex-none"
      >
    + New script
    </button>
  )}
  </div>

    <div className="flex gap-5 flex-1 min-h-0">
    <div className="flex-none w-[280px] bg-card border border-line rounded-xl overflow-y-auto">
      {scripts.length === 0 && (
    <div className="px-4 py-8 text-dim text-sm text-center">
      {isAdmin ? "No scripts yet. Add your first one." : "No scripts have been added yet."}
    </div>
    )}
      {grouped.map((group) => (
    <div key={group.category} className="flex flex-col">
    <div className="px-3.5 pt-3 pb-1.5 text-[10px] text-muted uppercase tracking-wide font-bold">
      {group.category}
    </div>
      {group.items.map((script) => (
      <button
        key={script.id}
        onClick={() => setSelectedId(script.id)}
        className={`text-left px-3.5 py-2 text-[13px] border-l-2 ${
          selectedId === script.id
          ? "bg-cardhover border-accent font-semibold"
          : "border-transparent text-[#AEB6C2] hover:bg-cardhover/60"
        }`}
        >
        {script.title}
      </button>
      ))}
    </div>
    ))}
    </div>
        <div className="flex-1 bg-card border border-line rounded-xl p-5 overflow-y-auto min-w-0">
          {!selected && (
            <div className="text-dim text-sm text-center py-10">
              {scripts.length === 0 ? "Nothing to show yet." : "Pick a script from the list."}
            </div>
          )}
          {selected && (
            <div className="flex flex-col gap-3.5 h-full">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="bg-accent/10 text-accentlight text-[10.5px] font-bold px-1.5 py-0.5 rounded-full">
                    {selected.category}
                  </span>
                  <h2 className="text-lg font-bold mt-1.5">{selected.title}</h2>
                </div>
                <div className="flex-none flex items-center gap-1.5">
                  <button
                    onClick={copyBody}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-line bg-cardhover hover:bg-cardhover/60"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => openEditForm(selected)}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-line bg-cardhover hover:bg-cardhover/60"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteScript(selected.id)}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-line text-bad hover:bg-bad/10"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap flex-1">{selected.body}</div>
            </div>
          )}
        </div>
    </div>
    {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-card border border-line rounded-xl p-5 w-full max-w-lg flex flex-col gap-3.5"
          >
            <div className="font-bold text-sm">{editingId ? "Edit script" : "New script"}</div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Cold open, Receptionist gatekeeper"
                autoFocus
                className="bg-cardhover border border-line rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ScriptCategory }))}
                className="bg-cardhover border border-line rounded-lg px-2.5 py-2 text-[12.5px]"
              >
                {SCRIPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted">Script</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={8}
                placeholder="What the rep actually says, line by line..."
                className="bg-cardhover border border-line rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent resize-y"
              />
            </div>
            {error && <div className="text-[12px] text-bad">{error}</div>
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="text-[12.5px] text-dim font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.title.trim() || !form.body.trim()}
                className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>          
                      </div>
          </form>
        </div>
      )}
    </div>
  );
}
