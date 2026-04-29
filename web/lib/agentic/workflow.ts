import { CN_INVESTMENT_DISCLAIMER } from "../report/disclaimer";
import { getSupabaseAdmin } from "../server/supabase-admin";
import { SECTION_ORDER } from "./default-prompts";
import { callDeepSeek, callLLMWithFallback } from "./model-router";
import { getPromptTemplate } from "./prompt-store";
import type { AgentInputContext, SectionResult, SectionAgentKey } from "./types";

interface CritiqueIssue {
  severity: "low" | "medium" | "high";
  issue: string;
  reason: string;
}

interface CritiquePayload {
  verdict: "pass" | "revise";
  issues: CritiqueIssue[];
}

function sectionUserPrompt(title: string, context: AgentInputContext): string {
  const dataBundle = (context.extraSignals?.agent_data_bundle as Record<string, unknown>) || {};
  const textCorpus = (context.extraSignals?.text_corpus as Record<string, unknown>) || {};
  const sectionFocus = (context.extraSignals?.section_focus as Record<string, unknown>) || {};
  return `请撰写【${title}】。\n\n标的：${context.stockName} (${context.stockCode})\n市场：${context.market}\n语言：中文\n可用财务样本年限：${context.financialWindowYears}年\n\n核心财务年度数据(JSON)：\n${JSON.stringify(
    context.financialData,
    null,
    2,
  )}\n\n三张表（结构化）(JSON)：\n${JSON.stringify(context.financialStatements || {}, null, 2)}\n\n财务可疑信号(JSON)：\n${JSON.stringify(
    context.fraudSignals || [],
    null,
    2,
  )}\n\n宏观快照(JSON)：\n${JSON.stringify(context.macroSnapshot || {}, null, 2)}\n\n补充信号(JSON)：\n${JSON.stringify(
    context.extraSignals || {},
    null,
    2,
  )}\n\nAgent 数据包(JSON，可直接消费)：\n${JSON.stringify(dataBundle, null, 2)}\n\nAgent 文本语料(JSON，可直接引用)：\n${JSON.stringify(
    textCorpus,
    null,
    2,
  )}\n\n章节专用数据提示(JSON)：\n${JSON.stringify(sectionFocus[title] || {}, null, 2)}\n\n硬性规则：\n1. 只能引用输入中的数据；禁止新增不存在的数据口径。\n2. 任何具体数字都要写明年份（如“2024年ROIC为xx%”）。\n3. 若宏观指标（M1/M2/CPI/失业率/政策利率/国债收益率）缺失，必须明确写“宏观数据缺失，禁止估算”。\n4. 新闻、公告、行业比较只能使用 supplementary 输入；缺失时必须写“数据缺失，禁止估算”。\n5. 行业比较优先使用 supplementary.industry 的 peers / industryPulse / industryNews。\n6. 可直接消费的数据包括：价格、财务三表、公告、新闻、行业温度、宏观雷达、证据锚点、数据血缘、文本语料。\n7. 如果证据不足，直接写“数据不足，暂不下结论”。\n8. 每个关键结论句后，补充“(证据: 年份, 指标, 数值)”短注。\n\n输出要求：只输出该段正文，不要加Markdown标题。`;
}

function criticUserPrompt(title: string, draft: string, context: AgentInputContext): string {
  const dataBundle = (context.extraSignals?.agent_data_bundle as Record<string, unknown>) || {};
  const textCorpus = (context.extraSignals?.text_corpus as Record<string, unknown>) || {};
  return `你是“反方审稿人”，请审查章节【${title}】草稿是否存在：\n1) 幻觉数字；2) 与输入数据冲突；3) 结论跳跃；4) 忽略财务可疑信号；5) 宏观/新闻/公告/行业数据缺失却强行给数值。\n\n输入财务数据(JSON)：\n${JSON.stringify(
    context.financialData,
    null,
    2,
  )}\n\n输入可疑信号(JSON)：\n${JSON.stringify(context.fraudSignals || [], null, 2)}\n\n补充数据(JSON)：\n${JSON.stringify(
    context.extraSignals || {},
    null,
    2,
  )}\n\nAgent 数据包(JSON)：\n${JSON.stringify(dataBundle, null, 2)}\n\nAgent 文本语料(JSON)：\n${JSON.stringify(
    textCorpus,
    null,
    2,
  )}\n\n宏观快照(JSON)：\n${JSON.stringify(
    context.macroSnapshot || {},
    null,
    2,
  )}\n\n待审稿文本：\n${draft}\n\n请仅输出 JSON：{"verdict":"pass|revise","issues":[{"severity":"low|medium|high","issue":"...","reason":"..."}]}。`;
}

function reviseUserPrompt(title: string, draft: string, critique: CritiquePayload, context: AgentInputContext): string {
  const dataBundle = (context.extraSignals?.agent_data_bundle as Record<string, unknown>) || {};
  const textCorpus = (context.extraSignals?.text_corpus as Record<string, unknown>) || {};
  return `请根据“反方审稿意见”修订章节【${title}】。\n\n原稿：\n${draft}\n\n审稿意见(JSON)：\n${JSON.stringify(
    critique,
    null,
    2,
  )}\n\n可用数据(节选)：\n财务年度数据(JSON)：${JSON.stringify(context.financialData, null, 2)}\n财务可疑信号(JSON)：${JSON.stringify(
    context.fraudSignals || [],
    null,
    2,
  )}\n补充数据(JSON)：${JSON.stringify(context.extraSignals || {}, null, 2)}\nAgent 数据包(JSON)：${JSON.stringify(
    dataBundle,
    null,
    2,
  )}\nAgent 文本语料(JSON)：${JSON.stringify(textCorpus, null, 2)}\n宏观快照(JSON)：${JSON.stringify(
    context.macroSnapshot || {},
    null,
    2,
  )}\n\n修订规则：\n1. 删除所有无证据数字。\n2. 保留七段研报应有的专业结论密度，避免空话。\n3. 风险提示必须对齐可疑信号中的证据。\n4. 宏观/新闻/公告/行业数据缺失时，必须保留“数据缺失，禁止估算”提示。\n5. 关键结论句保留“(证据: 年份, 指标, 数值)”短注。\n\n输出要求：只输出修订后的正文，不要输出 JSON。`;
}

function editorPrompt(sections: SectionResult[], context: AgentInputContext): string {
  const dataBundle = (context.extraSignals?.agent_data_bundle as Record<string, unknown>) || {};
  const textCorpus = (context.extraSignals?.text_corpus as Record<string, unknown>) || {};
  return `请统一润色以下七段内容，保持顺序不变，不新增段落，不删除段落：\n${sections
    .map((section) => `\n[${section.title}]\n${section.content}\n`)
    .join("\n")}\n\n宏观快照(JSON)：\n${JSON.stringify(context.macroSnapshot || {}, null, 2)}\n\nAgent 数据包(JSON)：\n${JSON.stringify(
    dataBundle,
    null,
    2,
  )}\n\nAgent 文本语料(JSON)：\n${JSON.stringify(textCorpus, null, 2)}\n\n要求：\n1. 若宏观指标缺失，必须保留“宏观数据缺失，禁止估算”提示。\n2. 不得引入任何输入之外的数字。\n3. 风险段要保留财务造假/质量风险信号。\n4. 保留并统一“(证据: 年份, 指标, 数值)”样式。\n5. 若引用消息/公告，优先引用文本语料中的原始标题或摘要。\n\n输出格式：JSON对象，字段必须是 section_texts（键为段落标题）和 disclaimer。`;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function parseCritique(text: string): CritiquePayload {
  const parsed = safeJsonParse(text);
  const verdict = parsed?.verdict === "pass" ? "pass" : "revise";
  const rawIssues = Array.isArray(parsed?.issues) ? parsed?.issues : [];
  const issues: CritiqueIssue[] = rawIssues
    .map((item) => {
      const issueObj = item as Record<string, unknown>;
      const severityRaw = String(issueObj.severity || "medium").toLowerCase();
      const severity: CritiqueIssue["severity"] =
        severityRaw === "low" || severityRaw === "high" ? (severityRaw as CritiqueIssue["severity"]) : "medium";
      const issue = String(issueObj.issue || "").trim();
      const reason = String(issueObj.reason || "").trim();
      if (!issue) return null;
      return { severity, issue, reason };
    })
    .filter((item): item is CritiqueIssue => Boolean(item));
  return { verdict: issues.length === 0 ? "pass" : verdict, issues };
}

async function runSectionDebate(params: {
  title: string;
  agentKey: SectionAgentKey;
  context: AgentInputContext;
  systemPrompt: string;
}): Promise<{ text: string; modelRoute: string; critique: CritiquePayload }> {
  let modelRoute = "";

  const draft = await callLLMWithFallback([
    { role: "system", content: params.systemPrompt },
    { role: "user", content: sectionUserPrompt(params.title, params.context) },
  ]);
  modelRoute = `${draft.provider}:${draft.model}`;

  const critic = await callLLMWithFallback([
    {
      role: "system",
      content:
        "你是极其严格的审稿反方。只负责挑错，不负责扩写。必须检查幻觉数字、证据缺失、逻辑跳跃与宏观数据滥用。",
    },
    { role: "user", content: criticUserPrompt(params.title, draft.text.trim(), params.context) },
  ]);
  if (!modelRoute) modelRoute = `${critic.provider}:${critic.model}`;
  const critique = parseCritique(critic.text);

  const revision = await callLLMWithFallback([
    {
      role: "system",
      content:
        "你是修订分析师。目标是在不引入新数据的前提下，消除幻觉、强化证据链、保留机构研报密度。禁止输出 JSON。",
    },
    {
      role: "user",
      content: reviseUserPrompt(params.title, draft.text.trim(), critique, params.context),
    },
  ]);
  if (!modelRoute) modelRoute = `${revision.provider}:${revision.model}`;
  return {
    text: revision.text.trim() || draft.text.trim(),
    modelRoute,
    critique,
  };
}

export async function runAgenticWorkflow(params: {
  userId: string;
  reportJobId: string;
  context: AgentInputContext;
}) {
  const supabase = getSupabaseAdmin() as any;
  const runId = crypto.randomUUID();
  await supabase.from("agent_runs").insert({
    id: runId,
    report_job_id: params.reportJobId,
    user_id: params.userId,
    status: "processing",
  });

  const sectionResults: SectionResult[] = [];
  const sectionErrors: string[] = [];
  const modelRoutes: string[] = [];

  await Promise.all(
    SECTION_ORDER.map(async (item, index) => {
      const sectionId = crypto.randomUUID();
      await supabase.from("agent_sections").insert({
        id: sectionId,
        run_id: runId,
        agent_key: item.key,
        section_title: item.title,
        section_order: index + 1,
        status: "processing",
        input_payload: {
          stock_code: params.context.stockCode,
          market: params.context.market,
          years: params.context.financialWindowYears,
          bundle_summary: {
            has_prices: Boolean((params.context.extraSignals as any)?.agent_data_bundle?.prices?.available),
            news_count: Number((params.context.extraSignals as any)?.agent_data_bundle?.news?.count || 0),
            announcement_count: Number((params.context.extraSignals as any)?.agent_data_bundle?.announcements?.count || 0),
            peer_count: Number(((params.context.extraSignals as any)?.agent_data_bundle?.industry?.peers || []).length),
            macro_count: Number(((params.context.extraSignals as any)?.agent_data_bundle?.macro?.indicators || []).length),
            evidence_count: Number(((params.context.extraSignals as any)?.agent_data_bundle?.evidence_anchors || []).length),
          },
        },
      });

      try {
        const prompt = await getPromptTemplate(item.key);
        const debated = await runSectionDebate({
          title: item.title,
          agentKey: item.key,
          context: params.context,
          systemPrompt: prompt.systemPrompt,
        });
        if (debated.modelRoute) modelRoutes.push(debated.modelRoute);

        sectionResults.push({
          agentKey: item.key,
          title: item.title,
          content: debated.text,
        });
        await supabase
          .from("agent_sections")
          .update({
            status: "completed",
            output_text: debated.text,
            input_payload: {
              stock_code: params.context.stockCode,
              market: params.context.market,
              years: params.context.financialWindowYears,
              critique: debated.critique,
            },
          })
          .eq("id", sectionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "agent failed";
        sectionErrors.push(`${item.key}: ${message}`);
        await supabase
          .from("agent_sections")
          .update({
            status: "failed",
            error_message: message,
          })
          .eq("id", sectionId);
      }
    }),
  );

  if (sectionResults.length === 0) {
    await supabase
      .from("agent_runs")
      .update({ status: "failed", error_message: sectionErrors.join(" | ") || "all agents failed" })
      .eq("id", runId);
    throw new Error("七段 Agent 全部失败");
  }

  const orderedSections = SECTION_ORDER.map((item) => {
    return (
      sectionResults.find((row) => row.agentKey === item.key) || {
        agentKey: item.key as SectionAgentKey,
        title: item.title,
        content: "该章节生成失败，已自动降级占位。请稍后重试。",
      }
    );
  });

  let routeModel = modelRoutes.join(" -> ");

  try {
    const editorTemplate = await getPromptTemplate("chief_editor");
    // 主编阶段固定走 DeepSeek 汇总，确保“七段辩论 -> 主编统一收口”一致性。
    const editorResult = await callDeepSeek([
      { role: "system", content: editorTemplate.systemPrompt },
      { role: "user", content: editorPrompt(orderedSections, params.context) },
    ]);
    routeModel = routeModel ? `${routeModel} -> ${editorResult.provider}:${editorResult.model}` : `${editorResult.provider}:${editorResult.model}`;

    const parsed = safeJsonParse(editorResult.text);
    const sectionTexts = (parsed?.section_texts || {}) as Record<string, string>;
    const disclaimer = (parsed?.disclaimer as string) || CN_INVESTMENT_DISCLAIMER;

    const normalized = orderedSections.map((item) => ({
      title: item.title,
      content: sectionTexts[item.title] || item.content,
      chartKeys: [],
    }));

    await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        source_model: routeModel,
      })
      .eq("id", runId);

    return {
      runId,
      sections: normalized,
      disclaimer,
      modelRoute: routeModel,
    };
  } catch (error) {
    const allowEditorFallback = process.env.ALLOW_EDITOR_FALLBACK === "true";
    if (!allowEditorFallback) {
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          source_model: routeModel,
          error_message: error instanceof Error ? error.message : "chief editor failed",
        })
        .eq("id", runId);
      throw error;
    }

    await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        source_model: routeModel,
        error_message: error instanceof Error ? error.message : "chief editor failed",
      })
      .eq("id", runId);

    return {
      runId,
      sections: orderedSections.map((item) => ({
        title: item.title,
        content: item.content,
        chartKeys: [],
      })),
      disclaimer: CN_INVESTMENT_DISCLAIMER,
      modelRoute: routeModel,
    };
  }
}
