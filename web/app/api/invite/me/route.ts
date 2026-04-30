import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser } from "../../../../lib/server/request-auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const supabase = getSupabaseAdmin();

    const { data: profile } = await supabase
      .from("profiles")
      .select("invite_code")
      .eq("id", user.id)
      .maybeSingle();

    const { data: invites } = await supabase
      .from("invites")
      .select("id,status,created_at,rewarded_at,invitee_user_id")
      .eq("inviter_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      inviteCode: profile?.invite_code || null,
      records: invites || [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取邀请数据失败" }, { status: 500 });
  }
}
