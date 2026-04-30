"use client";

import { FormEvent, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      if (error) throw error;
      setMsg("重置邮件已发送，请检查邮箱。");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="找回密码" subtitle="输入注册邮箱，系统会发送重置链接。">
      <div className="mx-auto w-full max-w-md">
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="注册邮箱"
            className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
          />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[var(--brand-primary)] px-3 py-2 font-medium text-white disabled:opacity-60">
            {loading ? "发送中..." : "发送重置邮件"}
          </button>
          {msg && <p className="text-sm text-[var(--text-secondary)]">{msg}</p>}
        </form>
      </div>
    </AppShell>
  );
}
