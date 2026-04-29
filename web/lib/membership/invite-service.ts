import { getSupabaseAdmin } from "../server/supabase-admin";
import { grantPaidEntitlement } from "./entitlement-service";

export async function bindInviteCode(params: {
  inviteCode: string;
  inviteeUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const supabase = getSupabaseAdmin();
  const code = params.inviteCode.trim().toUpperCase();

  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("id,invite_code")
    .eq("invite_code", code)
    .maybeSingle();

  if (!inviterProfile?.id) {
    return { ok: false, reason: "邀请码无效" };
  }
  if (inviterProfile.id === params.inviteeUserId) {
    return { ok: false, reason: "不能填写自己的邀请码" };
  }

  const { data: exists } = await supabase
    .from("invites")
    .select("id")
    .eq("invitee_user_id", params.inviteeUserId)
    .maybeSingle();
  if (exists?.id) {
    return { ok: false, reason: "该账号已绑定邀请码" };
  }

  const { error } = await supabase.from("invites").insert({
    inviter_user_id: inviterProfile.id,
    invite_code: code,
    invitee_user_id: params.inviteeUserId,
    status: "bound",
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

export async function tryGrantInviteRewardForFirstPaidUser(params: {
  paidUserId: string;
  reference: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: invite } = await supabase
    .from("invites")
    .select("id,inviter_user_id,status,rewarded_at")
    .eq("invitee_user_id", params.paidUserId)
    .eq("status", "bound")
    .maybeSingle();
  if (!invite?.id || !invite.inviter_user_id) {
    return;
  }

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.paidUserId)
    .eq("status", "paid");

  // 只奖励“首次成功付费”
  if ((count || 0) !== 1) {
    return;
  }

  await grantPaidEntitlement({
    userId: invite.inviter_user_id,
    tier: "vip",
    source: "invite_reward",
    reference: params.reference,
  });

  await supabase
    .from("invites")
    .update({
      status: "rewarded",
      rewarded_at: new Date().toISOString(),
    })
    .eq("id", invite.id);
}

