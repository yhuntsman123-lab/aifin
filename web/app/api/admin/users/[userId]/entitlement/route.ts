import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, isAdminUser } from "../../../../../../lib/server/request-auth";
import { getSupabaseAdmin } from "../../../../../../lib/server/supabase-admin";
import { ENTITLEMENT_DAYS } from "../../../../../../lib/membership/constants";
import { grantPaidEntitlement } from "../../../../../../lib/membership/entitlement-service";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } | Promise<{ userId: string }> },
) {
  try {
    const actor = await requireRequestUser(request);
    const admin = await isAdminUser(actor.id);
    if (!admin) {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

    const { userId } = await Promise.resolve(params);
    const body = (await request.json()) as {
      tier: "vip" | "svip";
      reason?: string;
    };
    if (!body.tier || !["vip", "svip"].includes(body.tier)) {
      return NextResponse.json({ error: "tier 仅支持 vip 或 svip" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: before } = await supabase.rpc("resolve_user_tier", { p_user_id: userId });
    const beforeInfo = before?.[0] || { tier: "free", expires_at: null };

    const result = await grantPaidEntitlement({
      userId,
      tier: body.tier,
      source: "admin",
      reference: `admin:${actor.id}`,
    });

    const afterTier = (result?.tier || body.tier) as string;
    const afterExp = result?.expires_at || new Date(Date.now() + ENTITLEMENT_DAYS[body.tier] * 86400000).toISOString();

    await supabase.from("admin_entitlement_audit").insert({
      admin_user_id: actor.id,
      target_user_id: userId,
      before_tier: beforeInfo.tier,
      before_end_at: beforeInfo.expires_at,
      after_tier: afterTier,
      after_end_at: afterExp,
      reason: body.reason || null,
    });

    return NextResponse.json({
      ok: true,
      before: beforeInfo,
      after: {
        tier: afterTier,
        expiresAt: afterExp,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "权限更新失败" },
      { status: 500 },
    );
  }
}
