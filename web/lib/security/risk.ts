import { getSupabaseAdmin } from "../server/supabase-admin";

export interface RiskSignalInput {
  userId?: string;
  ip?: string | null;
  deviceHash?: string;
  eventType: string;
  eventScore?: number;
  detail?: Record<string, unknown>;
}

export async function recordRiskSignal(input: RiskSignalInput) {
  const supabase = getSupabaseAdmin();
  await supabase.from("risk_events").insert({
    user_id: input.userId || null,
    ip: input.ip || null,
    device_hash: input.deviceHash || null,
    event_type: input.eventType,
    event_score: input.eventScore || 1,
    detail: input.detail || {},
  });
}

export async function isRegistrationAbusive(params: {
  ip?: string | null;
  deviceHash?: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let score = 0;
  if (params.ip) {
    const { data } = await supabase
      .from("risk_events")
      .select("event_score")
      .eq("ip", params.ip)
      .gte("created_at", since)
      .limit(100);
    score += (data || []).reduce((acc: number, row: any) => acc + Number(row.event_score || 0), 0);
  }

  if (params.deviceHash) {
    const { data } = await supabase
      .from("risk_events")
      .select("event_score")
      .eq("device_hash", params.deviceHash)
      .gte("created_at", since)
      .limit(100);
    score += (data || []).reduce((acc: number, row: any) => acc + Number(row.event_score || 0), 0);
  }

  return score >= 40;
}

export async function isFreeQuotaAbuseLikely(params: {
  ip?: string | null;
  deviceHash?: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  let hit = 0;
  if (params.ip) {
    const { count } = await supabase
      .from("risk_events")
      .select("id", { count: "exact", head: true })
      .eq("ip", params.ip)
      .in("event_type", ["report_generate", "checkout_turnstile_failed", "register_failed"])
      .gte("created_at", since);
    hit += Number(count || 0);
  }
  if (params.deviceHash) {
    const { count } = await supabase
      .from("risk_events")
      .select("id", { count: "exact", head: true })
      .eq("device_hash", params.deviceHash)
      .in("event_type", ["report_generate", "checkout_turnstile_failed", "register_failed"])
      .gte("created_at", since);
    hit += Number(count || 0);
  }
  return hit >= 30;
}
