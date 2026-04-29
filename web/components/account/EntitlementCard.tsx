"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";
import TurnstileWidget from "../security/TurnstileWidget";

interface EntitlementResponse {
  tier: "free" | "vip" | "svip";
  expiresAt: string | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

const TIER_STYLE: Record<string, string> = {
  free: "bg-slate-600 text-white",
  vip: "bg-blue-600 text-white",
  svip: "bg-amber-500 text-slate-900",
};

export default function EntitlementCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EntitlementResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [paying, setPaying] = useState<"vip_30d" | "svip_365d" | "">("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const tierLabel = useMemo(() => {
    if (!data) return "FREE";
    if (data.tier === "vip") return "VIP";
    if (data.tier === "svip") return "SVIP";
    return "FREE";
  }, [data]);

  const fetchEntitlement = async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) {
        setError("未登录");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/me/entitlement", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取权益失败");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取权益失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntitlement();
  }, []);

  const startCheckout = async (productCode: "vip_30d" | "svip_365d") => {
    try {
      if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
        throw new Error("请先完成人机验证");
      }
      setPaying(productCode);
      const supabase = getSupabaseBrowserClient();
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("请先登录");
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productCode,
          turnstileToken,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "拉起支付失败");
      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "支付失败");
    } finally {
      setTurnstileReset((v) => v + 1);
      setPaying("");
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">当前权益</p>
          {loading ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">加载中...</p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-1 ${TIER_STYLE[data?.tier || "free"]}`}>{tierLabel}</span>
              <span className="text-slate-700 dark:text-slate-300">
                到期日：{data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("zh-CN") : "未开通"}
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                今日剩余次数：{data?.remainingToday ?? "-"} / {data?.dailyLimit ?? "-"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(paying)}
            onClick={() => startCheckout("vip_30d")}
            className="rounded-md border border-blue-500 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-60 dark:hover:bg-blue-900/20"
          >
            {paying === "vip_30d" ? "处理中..." : "VIP ¥199 / 30天"}
          </button>
          <button
            type="button"
            disabled={Boolean(paying)}
            onClick={() => startCheckout("svip_365d")}
            className="rounded-md border border-amber-500 px-3 py-1 text-sm text-amber-600 hover:bg-amber-50 disabled:opacity-60 dark:hover:bg-amber-900/20"
          >
            {paying === "svip_365d" ? "处理中..." : "SVIP ¥1990 / 365天"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} action="checkout" />
    </section>
  );
}
