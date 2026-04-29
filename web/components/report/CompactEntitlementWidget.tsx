"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/client/supabase-browser";

interface EntitlementResponse {
  tier: "free" | "vip" | "svip";
  expiresAt: string | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

const BADGE_STYLE: Record<string, string> = {
  free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  vip: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  svip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function CompactEntitlementWidget() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EntitlementResponse | null>(null);

  const tierLabel = useMemo(() => {
    if (!data) return "FREE";
    if (data.tier === "svip") return "SVIP";
    if (data.tier === "vip") return "VIP";
    return "FREE";
  }, [data]);

  useEffect(() => {
    const fetchEntitlement = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: authData } = await supabase.auth.getSession();
        const token = authData.session?.access_token;
        if (!token) {
          setLoading(false);
          return;
        }
        const response = await fetch("/api/me/entitlement", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          setLoading(false);
          return;
        }
        const payload = (await response.json()) as EntitlementResponse;
        setData(payload);
      } finally {
        setLoading(false);
      }
    };
    fetchEntitlement();
  }, []);

  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/80 p-4 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-slate-900 dark:to-amber-900/20">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">会员权益</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_STYLE[data?.tier || "free"]}`}>
          {tierLabel}
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">加载中...</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p>
            等级：<span className="font-semibold">{tierLabel}</span>
          </p>
          <p>
            到期日：<span className="font-semibold">{data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("zh-CN") : "未开通"}</span>
          </p>
          <p>
            今日剩余次数：<span className="font-semibold">{data?.remainingToday ?? "-"} / {data?.dailyLimit ?? "-"}</span>
          </p>
        </div>
      )}
      <Link
        href="/account"
        className="mt-3 inline-flex items-center rounded-md border border-amber-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
      >
        续费升级
      </Link>
    </section>
  );
}

