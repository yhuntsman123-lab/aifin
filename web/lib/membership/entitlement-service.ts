import { getSupabaseAdmin } from "../server/supabase-admin";
import { DAILY_LIMIT_BY_TIER, ENTITLEMENT_DAYS, type UserTier } from "./constants";

export interface EffectiveEntitlement {
  tier: UserTier;
  expiresAt: string | null;
  dailyLimit: number;
}

export interface QuotaConsumeResult {
  allowed: boolean;
  tier: UserTier;
  usedCount: number;
  limitCount: number;
  remaining: number;
  expiresAt: string | null;
}

export async function getEffectiveEntitlement(userId: string): Promise<EffectiveEntitlement> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("resolve_user_tier", {
    p_user_id: userId,
  });
  if (error || !data || data.length === 0) {
    return { tier: "free", expiresAt: null, dailyLimit: DAILY_LIMIT_BY_TIER.free };
  }

  const row = data[0];
  const tier = (row.tier || "free") as UserTier;
  return {
    tier,
    expiresAt: row.expires_at || null,
    dailyLimit: Number(row.limit_count || DAILY_LIMIT_BY_TIER[tier]),
  };
}

export async function getTodayUsage(userId: string): Promise<{ usedCount: number; remaining: number }> {
  const entitlement = await getEffectiveEntitlement(userId);
  const supabase = getSupabaseAdmin();
  const usageDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }))
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("daily_usage")
    .select("used_count,limit_count")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  const used = Number(data?.used_count || 0);
  const remaining = Math.max((data?.limit_count || entitlement.dailyLimit) - used, 0);
  return { usedCount: used, remaining };
}

export async function consumeDailyQuota(userId: string): Promise<QuotaConsumeResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("consume_daily_quota", {
    p_user_id: userId,
  });
  if (error || !data || data.length === 0) {
    throw new Error(`consume_daily_quota 失败: ${error?.message || "unknown"}`);
  }
  const row = data[0];
  return {
    allowed: Boolean(row.allowed),
    tier: (row.tier || "free") as UserTier,
    usedCount: Number(row.used_count || 0),
    limitCount: Number(row.limit_count || 0),
    remaining: Number(row.remaining || 0),
    expiresAt: row.expires_at || null,
  };
}

export async function grantPaidEntitlement(params: {
  userId: string;
  tier: "vip" | "svip";
  source: "stripe" | "admin" | "invite_reward";
  reference?: string;
}) {
  const days = params.tier === "vip" ? ENTITLEMENT_DAYS.vip : ENTITLEMENT_DAYS.svip;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("grant_entitlement", {
    p_user_id: params.userId,
    p_tier: params.tier,
    p_days: days,
    p_source: params.source,
    p_reference: params.reference || null,
  });
  if (error) {
    throw new Error(`grant_entitlement 失败: ${error.message}`);
  }
  return data?.[0] || null;
}

