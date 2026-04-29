import { NextRequest, NextResponse } from "next/server";
import { getEffectiveEntitlement, getTodayUsage } from "../../../../lib/membership/entitlement-service";
import { requireRequestUser } from "../../../../lib/server/request-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const entitlement = await getEffectiveEntitlement(user.id);
    const usage = await getTodayUsage(user.id);

    return NextResponse.json({
      userId: user.id,
      tier: entitlement.tier,
      expiresAt: entitlement.expiresAt,
      dailyLimit: entitlement.dailyLimit,
      usedToday: usage.usedCount,
      remainingToday: usage.remaining,
      renewProducts: [
        {
          code: "vip_30d",
          label: "VIP 30天 / ¥199",
          tier: "vip",
          amountCny: 199,
        },
        {
          code: "svip_365d",
          label: "SVIP 365天 / ¥1990",
          tier: "svip",
          amountCny: 1990,
        },
      ],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取权益失败" },
      { status: 500 },
    );
  }
}
