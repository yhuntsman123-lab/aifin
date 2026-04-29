import { NextRequest, NextResponse } from "next/server";
import { buildDouyinScriptPrompt, buildWechatMarkdown, buildXiaohongshuNote } from "../../../../../../lib/report/derivatives";
import { buildLightweightPdf } from "../../../../../../lib/report/pdf-exporter";
import type { DerivativeTaskResult, InstitutionalReport } from "../../../../../../lib/report/types";
import { getSupabaseAdmin } from "../../../../../../lib/server/supabase-admin";

export const runtime = "nodejs";

type ActionName = "wechat" | "xiaohongshu" | "douyin" | "pdf";

const ASSET_BUCKET = process.env.REPORT_ASSET_BUCKET || "report-assets";
const SIGNED_URL_EXPIRES = 60 * 60 * 24 * 7;

function toInstitutionalReport(record: {
  id: string;
  title: string;
  stock_code: string;
  stock_name: string;
  html_url?: string;
  generated_at: string;
  payload?: Record<string, unknown>;
}): InstitutionalReport {
  const payload = (record.payload || {}) as Partial<InstitutionalReport>;
  return {
    id: record.id,
    title: payload.title || record.title,
    generatedAt: record.generated_at,
    lang: "zh-CN",
    htmlUrl: record.html_url,
    stock: payload.stock || {
      code: record.stock_code,
      name: record.stock_name,
      market: "CN",
    },
    sections: payload.sections || [],
    charts: payload.charts || [],
    disclaimer: payload.disclaimer,
    deepDiveSignals: payload.deepDiveSignals,
    financialStatements: payload.financialStatements,
    fraudSignals: payload.fraudSignals,
    macroSnapshot: payload.macroSnapshot,
    dataQuality: payload.dataQuality,
    supplementaryData: payload.supplementaryData,
    evidenceAnchors: payload.evidenceAnchors,
  };
}

async function createTask(action: ActionName, reportId: string): Promise<string> {
  const taskId = crypto.randomUUID();
  const supabase = getSupabaseAdmin() as any;
  await supabase.from("generation_tasks").insert({
    id: taskId,
    report_id: reportId,
    action,
    status: "queued",
  });
  return taskId;
}

async function completeTask(taskId: string, payload: Partial<DerivativeTaskResult>) {
  const supabase = getSupabaseAdmin() as any;
  await supabase
    .from("generation_tasks")
    .update({
      status: payload.status || "completed",
      output_url: payload.outputUrl || null,
      output_text: payload.outputText || null,
      output_json: payload.outputJson || null,
      error_message: payload.errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

async function failTask(taskId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "任务执行失败";
  await completeTask(taskId, { status: "failed", errorMessage: message });
}

async function uploadTextAndSign(path: string, content: string, contentType: string): Promise<string> {
  const supabase = getSupabaseAdmin() as any;
  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, new TextEncoder().encode(content), {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`上传文件失败: ${uploadError.message}`);
  }

  const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRES);
  if (error || !data?.signedUrl) {
    throw new Error(`创建下载链接失败: ${error?.message || "unknown"}`);
  }
  return data.signedUrl;
}

async function uploadBinaryAndSign(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const supabase = getSupabaseAdmin() as any;
  const { error: uploadError } = await supabase.storage.from(ASSET_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`上传文件失败: ${uploadError.message}`);
  }
  const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRES);
  if (error || !data?.signedUrl) {
    throw new Error(`创建下载链接失败: ${error?.message || "unknown"}`);
  }
  return data.signedUrl;
}

async function fetchReport(reportId: string): Promise<InstitutionalReport> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("reports")
    .select("id,title,stock_code,stock_name,html_url,generated_at,payload")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`未找到报告: ${reportId}`);
  }
  return toInstitutionalReport(data);
}

async function enqueueDouyinRender(taskId: string, report: InstitutionalReport): Promise<void> {
  const queueUrl = process.env.CLOUDFLARE_QUEUE_ENQUEUE_URL;
  const queueToken = process.env.CLOUDFLARE_QUEUE_TOKEN;
  if (!queueUrl || !queueToken) {
    throw new Error("未配置 Cloudflare 队列参数，无法发起 MP4 合成");
  }

  const response = await fetch(queueUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${queueToken}`,
    },
    body: JSON.stringify({
      taskId,
      action: "douyin_mp4",
      report,
      outputPath: `derivatives/${report.id}/douyin-${taskId}.mp4`,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Cloudflare 队列入队失败: ${message}`);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string; action: string } | Promise<{ reportId: string; action: string }> },
) {
  const { reportId, action } = await Promise.resolve(params);
  const validAction = action as ActionName;

  if (!["wechat", "xiaohongshu", "douyin", "pdf"].includes(validAction)) {
    return NextResponse.json({ error: `不支持的动作: ${action}` }, { status: 400 });
  }

  const taskId = await createTask(validAction, reportId);

  try {
    const report = await fetchReport(reportId);
    const body = (await request.json().catch(() => ({}))) as { mode?: "mp4" | "prompt" };

    if (validAction === "wechat") {
      const markdown = buildWechatMarkdown(report);
      const outputPath = `derivatives/${report.id}/wechat-${taskId}.md`;
      const outputUrl = await uploadTextAndSign(outputPath, markdown, "text/markdown; charset=utf-8");
      await completeTask(taskId, { status: "completed", outputText: markdown, outputUrl });
      return NextResponse.json({ taskId, status: "completed", outputUrl, markdown });
    }

    if (validAction === "xiaohongshu") {
      const note = buildXiaohongshuNote(report);
      const outputPath = `derivatives/${report.id}/xiaohongshu-${taskId}.md`;
      const outputUrl = await uploadTextAndSign(outputPath, note, "text/markdown; charset=utf-8");
      await completeTask(taskId, { status: "completed", outputText: note, outputUrl });
      return NextResponse.json({ taskId, status: "completed", outputUrl, note });
    }

    if (validAction === "pdf") {
      const pdfBytes = await buildLightweightPdf(report);
      const outputPath = `derivatives/${report.id}/report-${taskId}.pdf`;
      const outputUrl = await uploadBinaryAndSign(outputPath, pdfBytes, "application/pdf");
      await completeTask(taskId, { status: "completed", outputUrl });
      return NextResponse.json({ taskId, status: "completed", outputUrl });
    }

    // 抖音优先走异步 MP4。队列失败时，自动降级为提示词，确保功能可用。
    if (body.mode === "mp4") {
      try {
        await enqueueDouyinRender(taskId, report);
        return NextResponse.json({ taskId, status: "queued", mode: "mp4" }, { status: 202 });
      } catch {
        const prompt = buildDouyinScriptPrompt(report);
        await completeTask(taskId, { status: "completed", outputJson: prompt });
        return NextResponse.json({
          taskId,
          status: "completed",
          mode: "prompt",
          fallback: true,
          prompt,
        });
      }
    }

    const prompt = buildDouyinScriptPrompt(report);
    await completeTask(taskId, { status: "completed", outputJson: prompt });
    return NextResponse.json({ taskId, status: "completed", mode: "prompt", prompt });
  } catch (error) {
    await failTask(taskId, error);
    return NextResponse.json(
      {
        taskId,
        status: "failed",
        error: error instanceof Error ? error.message : "处理失败",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { reportId: string; action: string } | Promise<{ reportId: string; action: string }> },
) {
  const { reportId, action } = await Promise.resolve(params);
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("generation_tasks")
    .select("id,report_id,action,status,output_url,output_text,output_json,error_message,updated_at")
    .eq("report_id", reportId)
    .eq("action", action)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}
