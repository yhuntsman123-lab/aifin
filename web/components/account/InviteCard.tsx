"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";

type InviteRow = {
  id: string;
  status: string;
  created_at: string;
  rewarded_at: string | null;
  invitee_user_id: string;
};

export default function InviteCard() {
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<InviteRow[]>([]);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/invite/me", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) return;
      setCode(payload.inviteCode || null);
      setRows(payload.records || []);
    };
    run();
  }, []);

  const rewarded = rows.filter((item) => item.status === "rewarded").length;

  return (
    <section className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
      <h2 className="mb-2 text-lg font-semibold">邀请奖励</h2>
      <p className="text-sm text-[var(--text-secondary)]">我的邀请码：<span className="font-semibold text-[var(--brand-primary)]">{code || "-"}</span></p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">已邀请付费用户：{rewarded} 人（每人奖励 1 个月 VIP）</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line-default)]">
        <table className="w-full min-w-[540px] text-sm">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">被邀请用户</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">绑定时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--line-default)]">
                <td className="px-3 py-2">{row.invitee_user_id.slice(0, 8)}...</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{new Date(row.created_at).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-[var(--text-muted)]">暂无邀请记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
