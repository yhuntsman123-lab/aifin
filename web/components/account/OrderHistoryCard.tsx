"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";

type OrderRow = {
  id: string;
  product_code: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

function productLabel(code: string): string {
  if (code === "vip_30d") return "VIP 一次性（30天）";
  if (code === "svip_365d") return "SVIP 一次性（365天）";
  return code;
}

export default function OrderHistoryCard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/orders/me", { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "读取订单失败");
        setOrders(payload.orders || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取订单失败");
      }
    };
    run();
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
      <h2 className="mb-2 text-lg font-semibold">支付与权益记录</h2>
      {error && <p className="mb-2 text-sm text-[var(--danger)]">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--line-default)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">产品</th>
              <th className="px-3 py-2 text-left">金额</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">支付时间</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-[var(--line-default)]">
                <td className="px-3 py-2">{productLabel(order.product_code)}</td>
                <td className="px-3 py-2">¥{((order.amount || 0) / 100).toFixed(2)}</td>
                <td className="px-3 py-2">{order.status}</td>
                <td className="px-3 py-2">{order.paid_at ? new Date(order.paid_at).toLocaleString("zh-CN") : "-"}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-[var(--text-muted)]" colSpan={4}>
                  暂无支付记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
