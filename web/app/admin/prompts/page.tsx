"use client";

import { useEffect, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
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
      if (!selected && payload.templates?.length) setSelected(payload.templates[0]);
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
    <AppShell title="Agent Prompt 配置" subtitle="七段 Agent 与主编 Agent 的提示词可在此统一管理。">
      <div className="grid gap-4 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)] md:grid-cols-[300px,1fr]">
        <div className="rounded-xl border border-[var(--line-default)]">
          {rows.map((row) => (
            <button
              key={row.agentKey}
              type="button"
              onClick={() => setSelected(row)}
              className={`block w-full border-b border-[var(--line-default)] px-3 py-2 text-left text-sm ${
                selected?.agentKey === row.agentKey ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]" : ""
              }`}
            >
              {row.displayName}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--line-default)] p-4">
          {!selected ? (
            <p className="text-sm text-[var(--text-muted)]">请选择一个 Agent</p>
          ) : (
            <div className="space-y-3">
              <input
                value={selected.displayName}
                onChange={(event) => setSelected({ ...selected, displayName: event.target.value })}
                className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
              />
              <textarea
                value={selected.systemPrompt}
                onChange={(event) => setSelected({ ...selected, systemPrompt: event.target.value })}
                rows={16}
                className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
              />
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-[var(--brand-primary)] px-3 py-2 font-medium text-white"
              >
                保存 Prompt
              </button>
            </div>
          )}
          {message && <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>}
        </div>
      </div>
    </AppShell>
  );
}
