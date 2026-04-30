"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import TurnstileWidget from "../../components/security/TurnstileWidget";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [deviceHash] = useState(() => `dev_${Math.random().toString(36).slice(2, 12)}`);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
        throw new Error("请先完成人机验证");
      }
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          inviteCode: inviteCode || undefined,
          turnstileToken,
          deviceHash,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "注册失败");
      setMessage(payload.message || "注册成功，请查收验证邮件");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册失败");
    } finally {
      setTurnstileReset((v) => v + 1);
      setLoading(false);
    }
  };

  return (
    <AppShell title="注册账户" subtitle="FREE 用户每日 1 次，VIP 每日 10 次，SVIP 每日 20 次。">
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
          placeholder="密码（至少8位）"
          className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
        />
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="邀请码（可选）"
          className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--brand-primary)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {loading ? "注册中..." : "注册"}
        </button>
        <TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} action="register" />
        {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
        <p className="text-sm text-[var(--text-secondary)]">
          已有账号？<Link className="text-[var(--brand-primary)] underline" href="/login">去登录</Link>
        </p>
      </form>
      </div>
    </AppShell>
  );
}
