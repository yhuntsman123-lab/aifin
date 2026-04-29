import { runAgenticWorkflow } from "../agentic/workflow";
import { normalizeStockInput, resolveWithAliasTable } from "./unified-stock";
import { loadRealtimeFinancialSnapshot, buildDeepDiveSignals } from "./financial-data";
import { buildEvidenceAnchors } from "./evidence-anchors";
import { getSupabaseAdmin } from "../server/supabase-admin";

function reportTitle(stockName: string, stockCode: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${stockName}（${stockCode}）机构级中文研报 - ${date}`;
}

function buildChartManifest() {
  // 兼容 FinRobot 风格“多图研报”输出：先生成稳定的图表位清单，
  // 图片可由后续异步渲染器（Matplotlib / Vega / ECharts 导出）回填 URL。
  return [
    { key: "price-returns", title: "股价与区间收益表现" },
    { key: "dupont-tree", title: "杜邦分析树（ROE驱动拆解）" },
    { key: "roe-trend", title: "十年 ROE 趋势" },
    { key: "roic-wacc-gap", title: "ROIC vs WACC 剪刀差" },
    { key: "cashflow-profit-gap", title: "累计净利润 vs 累计自由现金流" },
    { key: "income-growth", title: "营收与净利润增速" },
    { key: "balance-quality", title: "资产负债结构与周转质量" },
    { key: "valuation-scenarios", title: "估值情景沙盘（牛/基/熊）" },
    { key: "industry-peer-compare", title: "行业可比公司对比" },
    { key: "news-sentiment", title: "新闻与情绪温度变化" },
    { key: "announcement-timeline", title: "公告时间轴与事件密度" },
    { key: "risk-redflags", title: "财务红旗雷达图" },
  ];
}

function sectionChartKeys(sectionTitle: string): string[] {
  const mapping: Record<string, string[]> = {
    投资要点: ["price-returns", "roic-wacc-gap"],
    基本面: ["dupont-tree", "roe-trend", "income-growth", "balance-quality"],
    估值模型: ["valuation-scenarios"],
    行业比较: ["industry-peer-compare"],
    消息面: ["news-sentiment", "announcement-timeline"],
    风险: ["cashflow-profit-gap", "risk-redflags"],
    结论: ["price-returns", "valuation-scenarios", "risk-redflags"],
  };
  return mapping[sectionTitle] || [];
}

function asDateText(input: string | undefined): string {
  if (!input) return "";
  return String(input).slice(0, 10);
}

function buildTextCorpus(params: {
  stockCode: string;
  stockName: string;
  supplementary: any;
  evidenceAnchors: Array<{
    sectionTitle: string;
    claim: string;
    year: string;
    metric: string;
    value: string;
    source: string;
  }>;
}) {
  const newsLines = (params.supplementary?.news?.items || []).slice(0, 12).map((item: any) => ({
    date: asDateText(item.date),
    title: item.headline || "",
    summary: item.summary || "",
    source: item.source || params.supplementary?.news?.source || "unknown",
    url: item.url || "",
  }));
  const annLines = (params.supplementary?.announcements?.items || []).slice(0, 12).map((item: any) => ({
    date: asDateText(item.date),
    title: item.title || "",
    source: item.source || params.supplementary?.announcements?.source || "unknown",
    url: item.url || "",
  }));
  const evidenceLines = params.evidenceAnchors.slice(0, 24).map((item) => ({
    section: item.sectionTitle,
    claim: item.claim,
    evidence: `${item.year} ${item.metric} ${item.value}`,
    source: item.source,
  }));

  return {
    report_subject: `${params.stockName} (${params.stockCode})`,
    news_digest: newsLines,
    announcement_digest: annLines,
    evidence_digest: evidenceLines,
  };
}

function buildSectionFocus(params: {
  supplementary: any;
  macroIndicators: unknown[];
  evidenceAnchors: Array<{ sectionTitle: string; claim: string; year: string; metric: string; value: string; source: string }>;
  fraudSignals: unknown[];
  statements: any;
  rows: unknown[];
}) {
  const bySection = (name: string) => params.evidenceAnchors.filter((row) => row.sectionTitle === name).slice(0, 8);
  return {
    投资要点: {
      price: params.supplementary?.prices || null,
      catalysts: (params.supplementary?.news?.items || []).slice(0, 5),
      evidence: bySection("投资要点"),
    },
    基本面: {
      financial_statements: params.statements || {},
      macro_radar: params.macroIndicators || [],
      evidence: bySection("基本面"),
    },
    估值模型: {
      valuation_inputs: {
        price: params.supplementary?.prices || null,
        peers: params.supplementary?.industry?.peers || [],
        peer_snapshots: params.supplementary?.industry?.peerSnapshots || [],
      },
      evidence: bySection("估值模型"),
    },
    行业比较: {
      industry: params.supplementary?.industry || {},
      evidence: bySection("行业比较"),
    },
    消息面: {
      news: params.supplementary?.news || {},
      announcements: params.supplementary?.announcements || {},
      industry_news: params.supplementary?.industry?.industryNews || {},
      evidence: bySection("消息面"),
    },
    风险: {
      fraud_signals: params.fraudSignals || [],
      data_lineage: params.supplementary?.sourceTrace || [],
      evidence: bySection("风险"),
    },
    结论: {
      summary_rows: (params.rows || []).slice(-3),
      price: params.supplementary?.prices || null,
      risk: params.fraudSignals || [],
      evidence: bySection("结论"),
    },
  };
}

export async function processReportJob(jobId: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data: job } = await supabase.from("report_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) {
    throw new Error(`report job 不存在: ${jobId}`);
  }
  if (job.status === "completed") {
    return job;
  }

  await supabase
    .from("report_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  try {
    let normalized = normalizeStockInput(job.stock_input);
    try {
      normalized = await resolveWithAliasTable(supabase, job.stock_input);
    } catch {
      // 别名解析失败时降级为规则解析，保证主链路不中断。
    }
    const snapshot = await loadRealtimeFinancialSnapshot({
      symbol: normalized.canonicalCode,
      market: normalized.market,
    });
    const deepDiveSignals = buildDeepDiveSignals(snapshot.rows);
    const evidenceAnchors = buildEvidenceAnchors({
      rows: snapshot.rows,
      fraudSignals: snapshot.fraudSignals,
      macroSnapshot: snapshot.macro,
      supplementary: snapshot.supplementary,
    });
    const textCorpus = buildTextCorpus({
      stockCode: normalized.canonicalCode,
      stockName: job.stock_name || normalized.canonicalCode,
      supplementary: snapshot.supplementary,
      evidenceAnchors,
    });
    const sectionFocus = buildSectionFocus({
      supplementary: snapshot.supplementary,
      macroIndicators: snapshot.macro?.indicators || [],
      evidenceAnchors,
      fraudSignals: snapshot.fraudSignals,
      statements: snapshot.statements,
      rows: snapshot.rows,
    });
    const agentDataBundle = {
      stock_profile: {
        code: normalized.canonicalCode,
        name: job.stock_name || normalized.canonicalCode,
        market: normalized.market,
      },
      prices: snapshot.supplementary?.prices || {},
      announcements: snapshot.supplementary?.announcements || {},
      news: snapshot.supplementary?.news || {},
      industry: snapshot.supplementary?.industry || {},
      macro: snapshot.macro || {},
      financial_rows: snapshot.rows || [],
      financial_statements: snapshot.statements || {},
      fraud_signals: snapshot.fraudSignals || [],
      evidence_anchors: evidenceAnchors,
      data_lineage: snapshot.supplementary?.sourceTrace || [],
      data_quality: snapshot.dataQuality,
      deep_dive: deepDiveSignals,
    };

    const workflow = await runAgenticWorkflow({
      userId: job.user_id,
      reportJobId: jobId,
      context: {
        stockCode: normalized.canonicalCode,
        stockName: job.stock_name || normalized.canonicalCode,
        market: normalized.market,
        lang: "zh-CN",
        financialWindowYears: snapshot.years || 0,
        financialData: snapshot.rows,
        financialStatements: snapshot.statements,
        fraudSignals: snapshot.fraudSignals,
        macroSnapshot: snapshot.macro,
        extraSignals: {
          agent_data_bundle: agentDataBundle,
          text_corpus: textCorpus,
          section_focus: sectionFocus,
          deep_dive: deepDiveSignals,
          supplementary: snapshot.supplementary,
          macro_radar: snapshot.macro?.indicators || [],
          industry_intel: {
            industry_name: snapshot.supplementary?.industry?.industryName || null,
            pulse: snapshot.supplementary?.industry?.industryPulse || null,
            industry_news: snapshot.supplementary?.industry?.industryNews || null,
            peers: snapshot.supplementary?.industry?.peers || [],
          },
          data_lineage: snapshot.supplementary.sourceTrace || [],
          evidence_anchors: evidenceAnchors,
          data_quality: snapshot.dataQuality,
          fallback_notice: snapshot.dataQuality.fallbackNotice,
        },
      },
    });

    const reportId = crypto.randomUUID();
    const chartManifest = buildChartManifest();
    const payload = {
      title: reportTitle(job.stock_name || normalized.canonicalCode, normalized.canonicalCode),
      lang: "zh-CN",
      stock: {
        code: normalized.canonicalCode,
        name: job.stock_name || normalized.canonicalCode,
        market: normalized.market,
      },
      sections: workflow.sections.map((section) => ({
        ...section,
        chartKeys: sectionChartKeys(section.title),
      })),
      charts: chartManifest,
      disclaimer: workflow.disclaimer,
      deepDiveSignals,
      financialStatements: snapshot.statements,
      fraudSignals: snapshot.fraudSignals,
      macroSnapshot: snapshot.macro,
      supplementaryData: snapshot.supplementary,
      dataQuality: snapshot.dataQuality,
      evidenceAnchors,
      meta: {
        jobId,
        runId: workflow.runId,
        modelRoute: workflow.modelRoute,
      },
    };

    await supabase.from("reports").insert({
      id: reportId,
      stock_code: normalized.canonicalCode,
      stock_name: job.stock_name || normalized.canonicalCode,
      title: payload.title,
      html_url: `/reports/${reportId}`,
      payload,
      generated_at: new Date().toISOString(),
    });

    await supabase
      .from("report_jobs")
      .update({
        status: "completed",
        report_id: reportId,
        stock_code: normalized.canonicalCode,
        market: normalized.market,
        model_route: {
          provider_path: workflow.modelRoute,
          order: ["cloudflare", "gemini", "deepseek"],
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      ...job,
      status: "completed",
      report_id: reportId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "job failed";
    await supabase
      .from("report_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw error;
  }
}
