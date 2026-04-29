"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/client/supabase-browser";

interface PromptRow {
  agentKey: string;
  displayName: string;
  systemPrompt: string;
}

export default function AdminPromptsPage() {
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [selected, setSelected] = useState<PromptRow | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("请先登录管理员账号");
      const response = await fetch("/api/admin/prompts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取失败");
      setRows(payload.templates || []);
      if (!selected && payload.templates?.length) {
        setSelected(payload.templates[0]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!selected) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("请先登录管理员账号");

      const response = await fetch("/api/admin/prompts", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selected),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      setMessage("保存成功");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  };

  return (
    <main className="mx-auto max-w-6xl p-6 text-slate-900 dark:text-slate-100">
      <h1 className="mb-4 text-2xl font-bold">Agent Prompt 配置</h1>
      <div className="grid gap-4 md:grid-cols-[300px,1fr]">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800">
          {rows.map((row) => (
            <button
              key={row.agentKey}
              type="button"
              onClick={() => setSelected(row)}
              className={`block w-full border-b border-slate-200 px-3 py-2 text-left text-sm dark:border-slate-800 ${
                selected?.agentKey === row.agentKey ? "bg-slate-100 dark:bg-slate-800" : ""
              }`}
            >
              {row.displayName}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          {!selected ? (
            <p className="text-sm text-slate-500">请选择一个 Agent</p>
          ) : (
            <div className="space-y-3">
              <input
                value={selected.displayName}
                onChange={(event) => setSelected({ ...selected, displayName: event.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
              <textarea
                value={selected.systemPrompt}
                onChange={(event) => setSelected({ ...selected, systemPrompt: event.target.value })}
                rows={16}
                className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={save}
                className="rounded-md bg-slate-900 px-3 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                保存 Prompt
              </button>
            </div>
          )}
          {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
        </div>
      </div>
    </main>
  );
}

