"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskLead } from "@/lib/types";

type TasksViewProps = {
    initialTasks: Task[];
    leads: TaskLead[];
    userId: string;
};

function isOverdue(task: Task) {
    return !task.completed && !!task.due_at && new Date(task.due_at) < new Date();
}

export default function TasksView({ initialTasks, leads, userId }: TasksViewProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [tab, setTab] = useState<"open" | "completed">("open");
    const [title, setTitle] = useState("");
    const [leadId, setLeadId] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
    const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

async function handleAddTask(e: React.FormEvent) {
      e.preventDefault();
      if (!title.trim()) return;
      setSaving(true);
      setError(null);

      const dueIso = dueAt ? new Date(dueAt).toISOString() : null;

      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert({
                  rep_id: userId,
                  lead_id: leadId || null,
                  title: title.trim(),
                  due_at: dueIso,
        })
        .select("*, leads(company_name)")
        .single();

      if (insertError || !data) {
              setError(insertError?.message ?? "Could not add that task.");
              setSaving(false);
              return;
      }

      setTasks((cur) => [...cur, data]);
      setTitle("");
      setLeadId("");
      setDueAt("");
      setSaving(false);
}

async function toggleComplete(task: Task) {
      const completed = !task.completed;
      const completedAt = completed ? new Date().toISOString() : null;
      const prev = tasks;
      setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, completed, completed_at: completedAt } : t)));

      const { error: updateError } = await supabase
        .from("tasks")
        .update({ completed, completed_at: completedAt })
        .eq("id", task.id);

      if (updateError) setTasks(prev);
}

  async function deleteTask(taskId: string) {
        const prev = tasks;
        setTasks((cur) => cur.filter((t) => t.id !== taskId));
        const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId);
        if (deleteError) setTasks(prev);
  }

  const list = tab === "open" ? openTasks : completedTasks;

return (
      <div className="p-7 flex flex-col gap-5">
            <div>
                    <h1 className="text-2xl font-extrabold m-0">Tasks</h1>
                    <div className="text-muted text-[13px] mt-1">
                              Follow ups and to-dos, yours to track. Optionally tie one to a lead.
                    </div>
            </div>
      
      <form
                onSubmit={handleAddTask}
                className="bg-card border border-line rounded-xl p-4.5 flex flex-wrap items-end gap-3"
              >
              <div className="flex flex-col gap-1 flex-[999_1_240px]">
                        <label className="text-[11px] text-muted">Task</label>
                        <input
                                      value={title}
                                      onChange={(e) => setTitle(e.target.value)}
                                      placeholder="e.g. Chase proposal sign-off"
                                      className="bg-cardhover border border-line rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent"
                                    />
              </div>
      
      <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted">Linked lead</label>
                <select
                              value={leadId}
                              onChange={(e) => setLeadId(e.target.value)}
                              className="bg-cardhover border border-line rounded-lg px-2.5 py-2 text-[12.5px]"
                            >
                            <option value="">No lead</option>
                  {leads.map((l) => (
                                            <option key={l.id} value={l.id}>
                                              {l.company_name}
                                            </option>
                                          ))}
                </select>
      </div>
      
      <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted">Due</label>
                <input
                              type="datetime-local"
                              value={dueAt}
                              onChange={(e) => setDueAt(e.target.value)}
                              className="bg-cardhover border border-line rounded-lg px-2.5 py-2 text-[12.5px]"
                            />
      </div>
              <button
                          type="submit"
                          disabled={saving || !title.trim()}
                          className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2 disabled:opacity-50"
                        >
                        + Add task
              </button>
      </form>
      
        {error && <div className="text-xs text-bad">{error}</div>}
      
            <div className="flex gap-1">
                    <button
                                onClick={() => setTab("open")}
                                className={`text-xs font-bold px-3.5 py-1.5 rounded-full border ${
                                              tab === "open" ? "bg-accent border-accent text-white" : "bg-cardhover border-line text-[#AEB6C2]"
                                }`}
                              >
                      {`Open (${openTasks.length})`}
                    </button>
                    <button
                                onClick={() => setTab("completed")}
                                className={`text-xs font-bold px-3.5 py-1.5 rounded-full border ${
                                              tab === "completed" ? "bg-accent border-accent text-white" : "bg-cardhover border-line text-[#AEB6C2]"
                                }`}
                              >
                      {`Completed (${completedTasks.length})`}
                    </button>
            </div>
      
      <div className="bg-card border border-line rounded-xl overflow-hidden">
        {list.length === 0 && (
                  <div className="px-4.5 py-8 text-dim text-sm text-center">
                    {tab === "open" ? "Nothing outstanding. Add a task above." : "No completed tasks yet."}
                  </div>
              )}
        {list.map((task) => {
                  const overdue = isOverdue(task);
                  return (
                                <div
                                                key={task.id}
                                                className="flex items-center gap-3 px-4.5 py-3 border-b border-line last:border-0"
                                              >
                                <button
                                                  onClick={() => toggleComplete(task)}
                                                  className={`w-[18px] h-[18px] flex-none rounded-md border flex items-center justify-center text-[11px] font-bold ${
                                                                      task.completed
                                                                        ? "bg-good border-good text-white"
                                                                        : "border-line bg-cardhover text-transparent"
                                                  }`}
                                                >
                                                X
                                </button>
                                <div className="flex-1 min-w-0">
                                                <div className={`text-[13px] font-semibold ${task.completed ? "line-through text-dim" : ""}`}>
                                                  {task.title}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                  {task.leads?.company_name && (
                                                                    <span className="bg-accent/10 text-accentlight text-[10.5px] font-bold px-1.5 py-0.5 rounded-full">
                                                                      {task.leads.company_name}
                                                                    </span>
                                                  )}
                                                            
                                                  {task.due_at && !task.completed && (
                                                                    <span
                                                                                            className={`text-[11px] ${overdue ? "text-bad font-semibold" : "text-dim"}`}
                                                                                            suppressHydrationWarning
                                                                                          >
                                                                      {overdue ? "Overdue: " : "Due "}
                                                                      {new Date(task.due_at).toLocaleString()}
                                                                    </span>
                                                                  )}
                                                  {task.completed && task.completed_at && (
                                                                    <span className="text-[11px] text-dim" suppressHydrationWarning>
                                                                                          Completed {new Date(task.completed_at).toLocaleString()}
                                                                    </span>
                                                                  )}
                                                </div>
                                </div>
                                <button
                                                  onClick={() => deleteTask(task.id)}
                                                  className="text-dim hover:text-bad text-[11px] font-bold px-1.5"
                                                >
                                                Remove
                                </button>
                                </div>
                              );
      })}
      </div>
      </div>
    );
}
