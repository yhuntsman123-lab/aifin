import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser } from "../../../../lib/server/request-auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("orders")
      .select("id,product_code,amount,currency,status,paid_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    return NextResponse.json({ orders: data || [] });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取订单失败" }, { status: 500 });
  }
}
