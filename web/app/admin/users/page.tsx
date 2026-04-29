"use client";

import { FormEvent, useEffect, useState } from "react";
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
    <main className="mx-auto max-w-5xl p-6 text-slate-900 dark:text-slate-100">
      <h1 className="mb-4 text-2xl font-bold">用户权限维护</h1>
      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索邮箱/昵称"
          className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          搜索
        </button>
      </form>

      {message && <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left">邮箱</th>
              <th className="px-3 py-2 text-left">当前等级</th>
              <th className="px-3 py-2 text-left">到期日</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-3 py-2">{user.email || "-"}</td>
                <td className="px-3 py-2">{user.effective_tier.toUpperCase()}</td>
                <td className="px-3 py-2">{user.expires_at ? new Date(user.expires_at).toLocaleString("zh-CN") : "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateTier(user.id, "vip")}
                      className="rounded border border-blue-500 px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      改为VIP
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTier(user.id, "svip")}
                      className="rounded border border-amber-500 px-2 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
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
    </main>
  );
}

