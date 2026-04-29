import { NextRequest, NextResponse } from "next/server";
import { buildDouyinScriptPrompt } from "../../../../../lib/report/derivatives";
import type { InstitutionalReport } from "../../../../../lib/report/types";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase-admin";

export const runtime = "nodejs";

interface RunBody {
  taskId?: string;
  report?: InstitutionalReport;
  outputUrl?: string;
  prompt?: Record<string, unknown>;
  errorMessage?: string;
}

async function completeTask(taskId: string, payload: {
  status: "completed" | "failed";
  outputUrl?: string | null;
  outputJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdmin() as any;
  await supabase
    .from("generation_tasks")
    .update({
      status: payload.status,
      output_url: payload.outputUrl || null,
      output_json: payload.outputJson || null,
      error_message: payload.errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_QUEUE_SECRET;
  const incoming = request.headers.get("x-internal-secret");
  if (!secret || incoming !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as RunBody;
    if (!body.taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    if (body.errorMessage) {
      await completeTask(body.taskId, {
        status: "failed",
        errorMessage: body.errorMessage,
      });
      return NextResponse.json({ ok: true, status: "failed" });
    }

    if (body.outputUrl) {
      await completeTask(body.taskId, {
        status: "completed",
        outputUrl: body.outputUrl,
      });
      return NextResponse.json({ ok: true, status: "completed", mode: "mp4" });
    }

    const prompt = body.prompt || (body.report ? buildDouyinScriptPrompt(body.report) : null);
    if (!prompt) {
      await completeTask(body.taskId, {
        status: "failed",
        errorMessage: "缺少 report/prompt，无法完成任务",
      });
      return NextResponse.json({ error: "report or prompt required" }, { status: 400 });
    }

    await completeTask(body.taskId, {
      status: "completed",
      outputJson: prompt,
    });
    return NextResponse.json({ ok: true, status: "completed", mode: "prompt" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "task run failed" },
      { status: 500 },
    );
  }
}
