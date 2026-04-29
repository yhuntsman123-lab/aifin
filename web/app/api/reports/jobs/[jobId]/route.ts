import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser } from "../../../../../lib/server/request-auth";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } | Promise<{ jobId: string }> },
) {
  try {
    const user = await requireRequestUser(request);
    const { jobId } = await Promise.resolve(params);
    const supabase = getSupabaseAdmin();
    const { data: job, error } = await supabase.from("report_jobs").select("*").eq("id", jobId).maybeSingle();
    if (error || !job) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: "无权限访问该任务" }, { status: 403 });
    }
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      reportId: job.report_id,
      errorMessage: job.error_message,
      requestedAt: job.requested_at,
      completedAt: job.completed_at,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ error: "读取任务失败" }, { status: 500 });
  }
}
