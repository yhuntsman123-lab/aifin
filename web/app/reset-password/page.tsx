"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      const hash = window.location.hash;
      if (!hash.includes("access_token")) return;
      const params = new URLSearchParams(hash.replace("#", ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };
    run();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("密码已更新，请使用新密码登录。");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新密码失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="重置密码" subtitle="请设置新的登录密码（至少 8 位）。">
      <div className="mx-auto w-full max-w-md">
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码"
            className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
          />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[var(--brand-primary)] px-3 py-2 font-medium text-white disabled:opacity-60">
            {loading ? "更新中..." : "更新密码"}
          </button>
          {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
        </form>
      </div>
    </AppShell>
  );
}
