import type { FraudSignal, MacroSnapshot, SupplementaryDataSnapshot } from "./financial-data";

export interface EvidenceAnchor {
  id: string;
  sectionTitle: string;
  claim: string;
  year: string;
  metric: string;
  value: string;
  source: string;
  note?: string;
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function safeYoY(curr: number, prev: number): number {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return 0;
  return (curr - prev) / Math.abs(prev);
}

export function buildEvidenceAnchors(params: {
  rows: Array<Record<string, unknown>>;
  fraudSignals: FraudSignal[];
  macroSnapshot: MacroSnapshot;
  supplementary: SupplementaryDataSnapshot;
}): EvidenceAnchor[] {
  const rows = [...params.rows].sort((a, b) => num(a.fiscal_year) - num(b.fiscal_year));
  if (rows.length === 0) return [];
  const latest = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : latest;
  const year = String(num(latest.fiscal_year) || "--");
  const prevYear = String(num(prev.fiscal_year) || "--");

  let cumulativeProfit = 0;
  let cumulativeFcf = 0;
  for (const row of rows) {
    cumulativeProfit += num(row.net_income);
    cumulativeFcf += num(row.free_cash_flow);
  }
  const conversion = cumulativeProfit !== 0 ? cumulativeFcf / cumulativeProfit : 0;

  const anchors: EvidenceAnchor[] = [
    {
      id: "alpha_roic_wacc",
      sectionTitle: "投资要点",
      claim: "价值创造由 ROIC-WACC 剪刀差决定",
      year,
      metric: "ROIC vs WACC",
      value: `${pct(num(latest.roic))} vs ${pct(num(latest.wacc))}`,
      source: "财务三表推导",
    },
    {
      id: "alpha_rev_growth",
      sectionTitle: "投资要点",
      claim: "收入增速衡量成长质量",
      year: `${prevYear}->${year}`,
      metric: "Revenue YoY",
      value: pct(safeYoY(num(latest.revenue), num(prev.revenue))),
      source: "利润表",
    },
    {
      id: "fundamental_dupont",
      sectionTitle: "基本面",
      claim: "杜邦拆解验证 ROE 驱动力",
      year,
      metric: "ROE = Margin × Turnover × Multiplier",
      value: `${pct(num(latest.net_margin))} × ${num(latest.asset_turnover).toFixed(2)} × ${num(
        latest.equity_multiplier,
      ).toFixed(2)} = ${pct(num(latest.roe))}`,
      source: "利润表+资产负债表",
    },
    {
      id: "valuation_eps",
      sectionTitle: "估值模型",
      claim: "估值锚点应绑定 EPS 与市值口径",
      year,
      metric: "Diluted EPS / Market Cap",
      value: `${num(latest.diluted_eps).toFixed(2)} / ${num(latest.market_cap).toFixed(0)}`,
      source: "利润表+市值",
    },
    {
      id: "industry_peers",
      sectionTitle: "行业比较",
      claim: "行业比较优先使用可比公司清单",
      year: "实时",
      metric: "Peer Symbols",
      value:
        params.supplementary.industry.available && params.supplementary.industry.peers.length > 0
          ? params.supplementary.industry.peers.join(", ")
          : "数据缺失",
      source: params.supplementary.industry.source,
      note: params.supplementary.industry.note,
    },
    {
      id: "news_headlines",
      sectionTitle: "消息面",
      claim: "消息面仅可引用已抓取新闻/公告",
      year: "最近14天",
      metric: "News/Filings Count",
      value: `${params.supplementary.news.count}/${params.supplementary.announcements.count}`,
      source: `${params.supplementary.news.source}+${params.supplementary.announcements.source}`,
      note:
        params.supplementary.news.note ||
        params.supplementary.announcements.note ||
        (params.supplementary.compliance?.strictNoEstimate ? "数据缺失时禁止估算" : undefined),
    },
    {
      id: "risk_cash_conversion",
      sectionTitle: "风险",
      claim: "利润与现金流偏离是核心财务风险",
      year: `${rows[0]?.fiscal_year ?? "--"}->${year}`,
      metric: "累计FCF/累计净利润",
      value: pct(conversion),
      source: "现金流量表+利润表",
    },
    {
      id: "conclusion_execution",
      sectionTitle: "结论",
      claim: "执行策略需与赔率与风险信号绑定",
      year,
      metric: "ROIC-WACC + Fraud Signals",
      value: `${pct(num(latest.roic) - num(latest.wacc))} / ${params.fraudSignals.length}项`,
      source: "财务三表+风控信号",
    },
  ];

  if (params.fraudSignals.length > 0) {
    const topSignal = params.fraudSignals[0];
    anchors.push({
      id: "risk_red_flag_top",
      sectionTitle: "风险",
      claim: "已识别高优先级财务红旗",
      year,
      metric: topSignal.title,
      value: topSignal.level.toUpperCase(),
      source: "财务可疑信号引擎",
      note: topSignal.evidence.join("；"),
    });
  }

  if (params.macroSnapshot.available) {
    const firstMacro = params.macroSnapshot.indicators?.find((x) => x.value !== null);
    if (firstMacro) {
      anchors.push({
        id: "macro_anchor",
        sectionTitle: "基本面",
        claim: "宏观判断必须锚定官方指标",
        year: firstMacro.asOfDate || "最新",
        metric: firstMacro.name,
        value: `${firstMacro.value}`,
        source: params.macroSnapshot.source,
        note: params.macroSnapshot.note,
      });
    }
  } else {
    anchors.push({
      id: "macro_missing_anchor",
      sectionTitle: "基本面",
      claim: "宏观官方数据缺失，禁止估算数值",
      year: "N/A",
      metric: "M1/M2/CPI/失业率等",
      value: "数据缺失",
      source: params.macroSnapshot.source,
      note: params.macroSnapshot.note,
    });
  }

  if (params.supplementary.sourceTrace && params.supplementary.sourceTrace.length > 0) {
    const missingChannels = params.supplementary.sourceTrace.filter((item) => item.status !== "ok");
    if (missingChannels.length > 0) {
      anchors.push({
        id: "source_trace_missing",
        sectionTitle: "风险",
        claim: "部分外部数据源缺失，相关结论需降级",
        year: "实时",
        metric: "Missing Channels",
        value: missingChannels.map((item) => `${item.channel}:${item.provider}`).join(" | "),
        source: "supplementary.sourceTrace",
        note: "缺失字段必须显式写“数据缺失，禁止估算”。",
      });
    }
  }

  return anchors;
}
