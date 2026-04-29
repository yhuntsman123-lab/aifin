import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/server/supabase-admin";
import { verifyTurnstileToken } from "../../../../lib/security/turnstile";
import { isRegistrationAbusive, recordRiskSignal } from "../../../../lib/security/risk";
import { bindInviteCode } from "../../../../lib/membership/invite-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email: string;
      password: string;
      turnstileToken?: string;
      inviteCode?: string;
      deviceHash?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    if (!email || password.length < 8) {
      return NextResponse.json({ error: "邮箱或密码不合法（密码至少8位）" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const passCaptcha = await verifyTurnstileToken({
      token: body.turnstileToken,
      remoteIp: ip,
    });
    if (!passCaptcha) {
      await recordRiskSignal({
        ip,
        deviceHash: body.deviceHash,
        eventType: "register_turnstile_failed",
        eventScore: 5,
        detail: { email },
      });
      return NextResponse.json({ error: "人机验证失败" }, { status: 400 });
    }

    const abusive = await isRegistrationAbusive({
      ip,
      deviceHash: body.deviceHash,
    });
    if (abusive) {
      await recordRiskSignal({
        ip,
        deviceHash: body.deviceHash,
        eventType: "register_blocked_abuse",
        eventScore: 10,
        detail: { email },
      });
      return NextResponse.json({ error: "注册请求过于频繁，请稍后再试" }, { status: 429 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (error || !data.user) {
      await recordRiskSignal({
        ip,
        deviceHash: body.deviceHash,
        eventType: "register_failed",
        eventScore: 3,
        detail: { email, reason: error?.message || "unknown" },
      });
      return NextResponse.json({ error: error?.message || "注册失败" }, { status: 400 });
    }

    if (body.inviteCode?.trim()) {
      await bindInviteCode({
        inviteCode: body.inviteCode,
        inviteeUserId: data.user.id,
      });
    }

    return NextResponse.json({
      ok: true,
      userId: data.user.id,
      message: "注册成功，请前往邮箱完成验证后登录",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 },
    );
  }
}
