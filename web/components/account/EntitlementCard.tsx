"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  free: "bg-[#6b7a94] text-white",
  vip: "bg-[var(--brand-primary)] text-white",
  svip: "bg-[#dba446] text-[#13233f]",
};

export default function EntitlementCard() {
  const searchParams = useSearchParams();
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

  useEffect(() => {
    const pay = searchParams.get("pay");
    if (pay === "success") {
      setError("");
      fetchEntitlement();
    }
  }, [searchParams]);

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
    <section className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">当前权益</p>
          {loading ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">加载中...</p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-1 ${TIER_STYLE[data?.tier || "free"]}`}>{tierLabel}</span>
              <span className="text-[var(--text-secondary)]">
                到期日：{data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("zh-CN") : "未开通"}
              </span>
              <span className="text-[var(--text-secondary)]">
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
            className="rounded-lg border border-[#3d70ff] px-3 py-1 text-sm text-[#3d70ff] hover:bg-[var(--brand-primary-soft)] disabled:opacity-60"
          >
            {paying === "vip_30d" ? "处理中..." : "VIP ¥199 / 30天"}
          </button>
          <button
            type="button"
            disabled={Boolean(paying)}
            onClick={() => startCheckout("svip_365d")}
            className="rounded-lg border border-[#dba446] px-3 py-1 text-sm text-[#dba446] hover:bg-[#fff8eb] disabled:opacity-60 dark:hover:bg-[#3d2c10]"
          >
            {paying === "svip_365d" ? "处理中..." : "SVIP ¥1990 / 365天"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      <TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} action="checkout" />
    </section>
  );
}
