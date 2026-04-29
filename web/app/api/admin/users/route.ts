import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, isAdminUser } from "../../../../lib/server/request-auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireRequestUser(request);
    const admin = await isAdminUser(actor.id);
    if (!admin) return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const limit = Number(request.nextUrl.searchParams.get("limit") || "30");
    const supabase = getSupabaseAdmin();

    let req = supabase.from("profiles").select("id,email,display_name,role,is_banned,invite_code").limit(limit);
    if (query) {
      req = req.or(`email.ilike.%${query}%,display_name.ilike.%${query}%`);
    }
    const { data: users, error } = await req;
    if (error) throw new Error(error.message);

    const result = await Promise.all(
      (users || []).map(async (user: any) => {
        const { data: entitlement } = await supabase.rpc("resolve_user_tier", { p_user_id: user.id });
        const info = entitlement?.[0] || { tier: "free", expires_at: null, limit_count: 1 };
        return {
          ...user,
          effective_tier: info.tier,
          expires_at: info.expires_at,
          daily_limit: info.limit_count,
        };
      }),
    );
    return NextResponse.json({ users: result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取用户失败" },
      { status: 500 },
    );
  }
}
