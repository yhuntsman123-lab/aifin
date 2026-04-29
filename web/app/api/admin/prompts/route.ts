import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, isAdminUser } from "../../../../lib/server/request-auth";
import { listPromptTemplates, upsertPromptTemplate } from "../../../../lib/agentic/prompt-store";
import type { AgentKey } from "../../../../lib/agentic/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const admin = await isAdminUser(user.id);
    if (!admin) return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
    const templates = await listPromptTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ error: "读取 Prompt 失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const admin = await isAdminUser(user.id);
    if (!admin) return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });

    const body = (await request.json()) as {
      agentKey: AgentKey;
      displayName: string;
      systemPrompt: string;
    };

    if (!body.agentKey || !body.displayName || !body.systemPrompt) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    await upsertPromptTemplate({
      agentKey: body.agentKey,
      displayName: body.displayName,
      systemPrompt: body.systemPrompt,
      updatedBy: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新 Prompt 失败" },
      { status: 500 },
    );
  }
}
