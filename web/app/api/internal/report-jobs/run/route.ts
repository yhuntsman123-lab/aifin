import { NextRequest, NextResponse } from "next/server";
import { processReportJob } from "../../../../../lib/report/job-processor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_QUEUE_SECRET;
  const incoming = request.headers.get("x-internal-secret");
  if (!secret || incoming !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { jobId: string };
    if (!body.jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }
    await processReportJob(body.jobId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "job processing failed" },
      { status: 500 },
    );
  }
}
