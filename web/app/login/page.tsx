"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "../../components/layout/AppShell";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const next = searchParams.get("next");
      window.location.href = next || "/account";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="登录账户" subtitle="登录后可查看权益、购买会员并生成机构级中文研报。">
      <div className="mx-auto w-full max-w-md">
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--brand-primary)] px-3 py-2 font-medium text-white disabled:opacity-60"
          >
            {loading ? "登录中..." : "登录"}
          </button>
          {message && <p className="text-sm text-[var(--danger)]">{message}</p>}
          <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
            <p>
              还没有账号？<Link className="text-[var(--brand-primary)] underline" href="/register">去注册</Link>
            </p>
            <Link className="text-[var(--brand-primary)] underline" href="/forgot-password">
              忘记密码
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
