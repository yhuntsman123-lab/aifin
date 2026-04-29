import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser } from "../../../../lib/server/request-auth";
import { consumeDailyQuota } from "../../../../lib/membership/entitlement-service";
import { verifyTurnstileToken } from "../../../../lib/security/turnstile";
import { isFreeQuotaAbuseLikely, recordRiskSignal } from "../../../../lib/security/risk";
import { getSupabaseAdmin } from "../../../../lib/server/supabase-admin";
import { processReportJob } from "../../../../lib/report/job-processor";

export const runtime = "nodejs";

async function enqueueReportJob(jobId: string): Promise<boolean> {
  const queueUrl = process.env.CLOUDFLARE_QUEUE_ENQUEUE_URL;
  const token = process.env.CLOUDFLARE_QUEUE_TOKEN;
  if (!queueUrl || !token) return false;

  const response = await fetch(queueUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "process_report_job",
      jobId,
    }),
  });
  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json()) as {
      stockInput: string;
      stockName?: string;
      turnstileToken?: string;
      deviceHash?: string;
    };

    if (!body.stockInput?.trim()) {
      return NextResponse.json({ error: "stockInput 不能为空" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const passCaptcha = await verifyTurnstileToken({ token: body.turnstileToken, remoteIp: ip });
    if (!passCaptcha) {
      await recordRiskSignal({
        userId: user.id,
        ip,
        deviceHash: body.deviceHash,
        eventType: "report_generate_turnstile_failed",
        eventScore: 4,
      });
      return NextResponse.json({ error: "人机验证失败" }, { status: 400 });
    }

    const abuse = await isFreeQuotaAbuseLikely({ ip, deviceHash: body.deviceHash });
    if (abuse) {
      await recordRiskSignal({
        userId: user.id,
        ip,
        deviceHash: body.deviceHash,
        eventType: "report_generate_blocked_abuse",
        eventScore: 8,
      });
      return NextResponse.json({ error: "请求频率异常，请稍后再试" }, { status: 429 });
    }

    const quota = await consumeDailyQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `今日额度已用完（${quota.tier.toUpperCase()} 每日上限 ${quota.limitCount} 次）`,
          quota,
        },
        { status: 429 },
      );
    }

    const jobId = crypto.randomUUID();
    const supabase = getSupabaseAdmin();
    await supabase.from("report_jobs").insert({
      id: jobId,
      user_id: user.id,
      stock_input: body.stockInput.trim(),
      stock_name: body.stockName || body.stockInput.trim(),
      status: "queued",
      quota_snapshot: {
        tier: quota.tier,
        used_count: quota.usedCount,
        limit_count: quota.limitCount,
        remaining: quota.remaining,
        expires_at: quota.expiresAt,
      },
      context: {
        lang: "zh-CN",
        section_order: ["投资要点", "基本面", "估值模型", "行业比较", "消息面", "风险", "结论"],
      },
    });

    const queued = await enqueueReportJob(jobId);
    await recordRiskSignal({
      userId: user.id,
      ip,
      deviceHash: body.deviceHash,
      eventType: "report_generate",
      eventScore: 1,
      detail: { stock_input: body.stockInput.trim(), queued },
    });
    if (!queued) {
      const done = await processReportJob(jobId);
      return NextResponse.json({
        jobId,
        status: "completed",
        reportId: done.report_id || null,
      });
    }

    return NextResponse.json(
      {
        jobId,
        status: "queued",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成任务创建失败" },
      { status: 500 },
    );
  }
}
