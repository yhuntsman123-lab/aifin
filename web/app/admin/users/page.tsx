"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import { getSupabaseBrowserClient } from "../../../lib/client/supabase-browser";

interface AdminUserItem {
  id: string;
  email?: string;
  display_name?: string;
  effective_tier: "free" | "vip" | "svip";
  expires_at: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("请先登录管理员账号");

      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取失败");
      setUsers(payload.users || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取失败");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateTier = async (userId: string, tier: "vip" | "svip") => {
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("请先登录管理员账号");

      const response = await fetch(`/api/admin/users/${userId}/entitlement`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier, reason: "后台手动调整" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失败");
      setMessage("更新成功");
      fetchUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    }
  };

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    fetchUsers();
  };

  return (
    <AppShell title="后台用户权限" subtitle="管理员可手动把用户调整为 VIP / SVIP，调整后即时生效。">
      <div className="space-y-4 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索邮箱/昵称"
            className="w-full rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-xl border border-[var(--line-default)] px-3 py-2 hover:bg-[var(--bg-subtle)]"
          >
            搜索
          </button>
        </form>

        {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}

        <div className="overflow-x-auto rounded-xl border border-[var(--line-default)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[var(--bg-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left">邮箱</th>
                <th className="px-3 py-2 text-left">当前等级</th>
                <th className="px-3 py-2 text-left">到期日</th>
                <th className="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[var(--line-default)]">
                  <td className="px-3 py-2">{user.email || "-"}</td>
                  <td className="px-3 py-2">{user.effective_tier.toUpperCase()}</td>
                  <td className="px-3 py-2">{user.expires_at ? new Date(user.expires_at).toLocaleString("zh-CN") : "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateTier(user.id, "vip")}
                        className="rounded-lg border border-[#3d70ff] px-2 py-1 text-[#3d70ff] hover:bg-[var(--brand-primary-soft)]"
                      >
                        改为VIP
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTier(user.id, "svip")}
                        className="rounded-lg border border-[#dba446] px-2 py-1 text-[#dba446] hover:bg-[#fff8eb] dark:hover:bg-[#3d2c10]"
                      >
                        改为SVIP
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
