import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser } from "../../../../lib/server/request-auth";
import { bindInviteCode } from "../../../../lib/membership/invite-service";
import { recordRiskSignal } from "../../../../lib/security/risk";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json()) as { inviteCode: string; deviceHash?: string };
    if (!body.inviteCode?.trim()) {
      return NextResponse.json({ error: "inviteCode 不能为空" }, { status: 400 });
    }
    const result = await bindInviteCode({
      inviteCode: body.inviteCode,
      inviteeUserId: user.id,
    });
    if (!result.ok) {
      await recordRiskSignal({
        userId: user.id,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        deviceHash: body.deviceHash,
        eventType: "invite_bind_failed",
        eventScore: 2,
        detail: { reason: result.reason || "unknown" },
      });
      return NextResponse.json({ error: result.reason || "绑定失败" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ error: "绑定邀请码失败" }, { status: 500 });
  }
}
