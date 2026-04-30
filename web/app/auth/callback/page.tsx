"use client";

import { useEffect, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import { getSupabaseBrowserClient } from "../../../lib/client/supabase-browser";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在验证登录状态...");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setMessage("验证成功，正在跳转...");
          setTimeout(() => {
            window.location.href = "/account";
          }, 600);
          return;
        }
        setMessage("未检测到授权参数，请重新登录。");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "验证失败");
      }
    };
    run();
  }, []);

  return (
    <AppShell title="账户验证" subtitle="邮箱验证完成后将自动进入账户中心。">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
        {message}
      </div>
    </AppShell>
  );
}
