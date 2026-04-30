import { normalizeChineseInstitutionalReport } from "./chinese-template";
import type { InstitutionalReport } from "./types";

const DISCLAIMER = "免责声明：本报告由 AIFinView Agentic Workflow 自动生成，仅供研究参考，不构成任何投资建议。市场有风险，投资需谨慎。";

function buildYearly(base: {
  years: number[];
  revenue: number[];
  netIncome: number[];
  roic: number[];
  wacc: number[];
  roe: number[];
  margin: number[];
  turnover: number[];
  equity: number[];
  fcf: number[];
}) {
  return base.years.map((y, i) => ({
    fiscal_year: y,
    revenue: base.revenue[i],
    net_income: base.netIncome[i],
    roic: base.roic[i],
    wacc: base.wacc[i],
    roe: base.roe[i],
    net_margin: base.margin[i],
    asset_turnover: base.turnover[i],
    equity_multiplier: base.equity[i],
    free_cash_flow: base.fcf[i],
  }));
}

function buildIncome(years: number[], rev: number[], ni: number[]): Array<Record<string, unknown>> {
  return years.map((y, i) => ({
    fiscal_year: y,
    revenue: rev[i],
    net_income: ni[i],
    gross_profit: rev[i] * 0.42,
    operating_income: ni[i] * 1.28,
  }));
}

function buildBalance(years: number[], rev: number[]): Array<Record<string, unknown>> {
  return years.map((y, i) => ({
    fiscal_year: y,
    total_assets: rev[i] * 1.65,
    total_liabilities: rev[i] * 0.86,
    shareholder_equity: rev[i] * 0.79,
    cash_and_equivalents: rev[i] * 0.14,
  }));
}

function buildCashflow(years: number[], ni: number[], fcf: number[]): Array<Record<string, unknown>> {
  return years.map((y, i) => ({
    fiscal_year: y,
    operating_cash_flow: ni[i] * 1.18,
    capex: Math.max(ni[i] * 0.32, 1),
    free_cash_flow: fcf[i],
    net_income: ni[i],
  }));
}

const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

const demoReportsRaw: Record<string, InstitutionalReport> = {
  "demo-aapl": {
    id: "demo-aapl",
    title: "苹果公司（AAPL.O）机构级中文研报（演示）",
    generatedAt: "2026-04-30T10:00:00+08:00",
    lang: "zh-CN",
    stock: { code: "AAPL.O", name: "苹果公司", shortName: "苹果", market: "US" },
    sections: [
      { title: "投资要点", content: "评级：标配，12个月目标价区间 220-245 美元。\n预期差：市场担忧 iPhone 增速回落，而我们看到服务收入与端侧 AI 生态的利润弹性持续增强。\n3-6个月催化剂：新机型发布周期、服务订阅提价兑现、回购规模继续提升 EPS。" },
      { title: "基本面", content: "宏观映射：美国实际利率高位震荡，但现金流稳定的高 ROIC 公司仍具估值韧性。\n商业模式：苹果的利润核心来自品牌溢价+生态锁定，而非单纯硬件周转。\n十年 ROIC vs WACC：ROIC 全周期显著高于 WACC，价值创造连续性强。\n杜邦拆解：ROE 上行主要由净利率与资本效率贡献，杠杆贡献相对有限。" },
      { title: "估值模型", content: "SOTP：硬件业务采用稳健 PE 区间，服务业务给予溢价倍数。\nDCF：WACC 采用市场风险溢价+Beta 校准，永续增长率控制在保守区间。\n情景：牛市20%/基准60%/熊市20%，对应目标价 255/232/198 美元。" },
      { title: "行业比较", content: "利润池仍向品牌与生态平台集中。\n与核心可比公司相比，苹果在现金回流、回购强度与渠道控制上优势明显。\n行业资本开支增速低于收入增速，供给端未见失控扩张。" },
      { title: "消息面", content: "高频追踪显示北美渠道库存健康，服务订阅留存率稳定。\n市场情绪中性偏乐观，机构仓位并未极端拥挤。\n未来重点事件：新品发布会、财报季指引、反垄断政策进展。" },
      { title: "风险", content: "核心风险一：监管对应用商店分成模式的边际约束。\n核心风险二：主要新品创新不及预期导致 ASP 承压。\n核心风险三：供应链地缘扰动带来毛利率短期波动。" },
      { title: "结论", content: "赔率评估：当前风险收益比仍具吸引力。\n策略建议：回调分批布局，重点观察服务收入与回购节奏。\n对冲建议：若宏观波动放大，可用纳指 ETF 对冲系统性 Beta 风险。" },
    ],
    charts: [
      { key: "roic_wacc", title: "ROIC vs WACC" },
      { key: "dupont", title: "杜邦分析树" },
      { key: "cash_profit", title: "累计 FCF vs 累计净利润" },
    ],
    disclaimer: DISCLAIMER,
    deepDiveSignals: {
      yearly: buildYearly({
        years: YEARS,
        revenue: [233715, 215639, 229234, 265595, 260174, 274515, 365817, 394328, 383285, 391035],
        netIncome: [53394, 45687, 48351, 59531, 55256, 57411, 94680, 99803, 96995, 93736],
        roic: [0.201, 0.224, 0.213, 0.233, 0.196, 0.212, 0.247, 0.276, 0.289, 0.26],
        wacc: [0.074, 0.076, 0.076, 0.078, 0.078, 0.079, 0.081, 0.083, 0.084, 0.086],
        roe: [0.63, 0.59, 0.56, 0.54, 0.61, 0.73, 1.47, 1.74, 1.71, 1.60],
        margin: [0.228, 0.212, 0.211, 0.224, 0.212, 0.209, 0.259, 0.253, 0.253, 0.24],
        turnover: [0.71, 0.68, 0.69, 0.75, 0.7, 0.73, 0.89, 0.93, 0.9, 0.88],
        equity: [3.88, 4.05, 3.86, 3.2, 4.11, 4.8, 6.35, 7.44, 7.51, 7.58],
        fcf: [70019, 53397, 51774, 64121, 58896, 73365, 92953, 111443, 99584, 108807],
      }),
      cumulative: YEARS.map((y, i) => ({ year: y, cumulative_net_income: [53394, 99081, 147432, 206963, 262219, 319630, 414310, 514113, 611108, 704844][i], cumulative_fcf: [70019, 123416, 175190, 239311, 298207, 371572, 464525, 575968, 675552, 784359][i] })),
      retained_roi_percent: 186,
    },
    financialStatements: {
      income_statement: buildIncome(YEARS, [233715, 215639, 229234, 265595, 260174, 274515, 365817, 394328, 383285, 391035], [53394, 45687, 48351, 59531, 55256, 57411, 94680, 99803, 96995, 93736]),
      balance_sheet: buildBalance(YEARS, [233715, 215639, 229234, 265595, 260174, 274515, 365817, 394328, 383285, 391035]),
      cash_flow: buildCashflow(YEARS, [53394, 45687, 48351, 59531, 55256, 57411, 94680, 99803, 96995, 93736], [70019, 53397, 51774, 64121, 58896, 73365, 92953, 111443, 99584, 108807]),
    },
    fraudSignals: [
      { id: "a1", level: "medium", title: "应收账款增速监控", detail: "近三年应收账款增速低于收入增速，暂未出现明显红旗。", evidence: ["2022-2024应收周转天数稳定"] },
      { id: "a2", level: "low", title: "利润现金匹配", detail: "累计 FCF 高于累计净利润，现金质量优秀。", evidence: ["10年累计FCF/净利润>1"] },
    ],
    macroSnapshot: {
      source: "FRED+东财+Yahoo",
      available: true,
      note: "美元流动性与风险偏好中性。",
      indicators: [
        { id: "m1", name: "美国M2同比", value: 1.9, unit: "%" },
        { id: "us10y", name: "美债10Y", value: 4.12, unit: "%" },
        { id: "vix", name: "VIX", value: 16.4 },
      ],
    },
    dataQuality: { source: "multi-source", missingMetrics: [], fiscalYearCount: 10, fallbackNotice: "无", lastRefreshAt: "2026-04-30T09:58:00+08:00" },
    supplementaryData: {
      prices: { source: "yfinance", available: true, latest: 196.98, currency: "USD", latestDate: "2026-04-29", return12m: 0.225 },
      news: { source: "Finnhub+Yahoo", available: true, count: 32, items: [{ date: "2026-04-28", headline: "苹果公布新一代芯片路线图", source: "Yahoo Finance" }] },
      announcements: { source: "SEC", available: true, count: 14, items: [{ date: "2026-04-24", title: "8-K: Quarterly earnings", source: "SEC" }] },
      industry: { source: "Finnhub", available: true, peers: ["MSFT", "GOOGL", "AMZN"], industryName: "消费电子与平台生态" },
      sourceTrace: [
        { channel: "prices", provider: "yfinance", status: "ok", note: "实时价格可用" },
        { channel: "news", provider: "Finnhub", status: "ok", note: "新闻完整" },
        { channel: "announcements", provider: "SEC", status: "ok", note: "公告可追溯" },
        { channel: "industry", provider: "Finnhub", status: "ok", note: "同业样本可用" },
      ],
      compliance: { strictNoEstimate: true, policy: "缺失数据显式提示，禁止估算" },
    },
    evidenceAnchors: [
      { id: "e1", sectionTitle: "基本面", claim: "ROIC 长期高于 WACC", year: "2024", metric: "ROIC-WACC", value: "17.4pct", source: "10-K + 模型" },
      { id: "e2", sectionTitle: "风险", claim: "现金质量良好", year: "2015-2024", metric: "累计FCF/累计净利润", value: "1.11x", source: "现金流量表" },
      { id: "e3", sectionTitle: "估值模型", claim: "回购提升 EPS", year: "2024", metric: "回购规模", value: "$110B", source: "财报披露" },
    ],
  },
  "demo-tencent": {
    id: "demo-tencent",
    title: "腾讯控股（0700.HK）机构级中文研报（演示）",
    generatedAt: "2026-04-30T10:10:00+08:00",
    lang: "zh-CN",
    stock: { code: "0700.HK", name: "腾讯控股", shortName: "腾讯", market: "HK" },
    sections: [
      { title: "投资要点", content: "评级：标配，目标价区间 410-470 港元。\n预期差：市场对游戏监管扰动仍有记忆，但广告与视频号商业化斜率被低估。\n催化剂：版号节奏、视频号电商渗透、回购持续。" },
      { title: "基本面", content: "宏观映射：国内信用脉冲改善，平台经济边际友好。\n商业模式：社交流量入口+广告+游戏+金融科技多引擎。\nROIC-WACC 剪刀差保持正值，资本配置质量较高。\n杜邦中净利率与周转效率协同改善。" },
      { title: "估值模型", content: "SOTP 估值：游戏、广告、金融科技分拆估值后加总。\nDCF 假设偏保守，永续增长率不超过名义 GDP 增速。\n情景价格：牛市 500 / 基准 445 / 熊市 360 港元。" },
      { title: "行业比较", content: "与同业相比，腾讯在流量分发和生态闭环上更强。\n行业利润池向内容与广告技术平台集中。\nCapex 节奏可控，未见无序扩张。" },
      { title: "消息面", content: "高频跟踪显示视频号商业化效率持续提升。\n舆情从防御切向结构性成长。\n政策与版号仍是关键跟踪点。" },
      { title: "风险", content: "监管节奏不确定。\n广告景气回落。\n新业务投入回报不及预期。" },
      { title: "结论", content: "赔率中上，建议回调布局。\n若政策波动放大，可配置恒生科技指数对冲。" },
    ],
    charts: [{ key: "roic_wacc", title: "ROIC vs WACC" }],
    disclaimer: DISCLAIMER,
    deepDiveSignals: {
      yearly: buildYearly({ years: YEARS, revenue: [102863, 151938, 237760, 312694, 377289, 482064, 560118, 554552, 609015, 652300], netIncome: [29108, 41447, 71510, 77469, 93310, 122742, 224822, 188243, 159847, 175123], roic: [0.11, 0.126, 0.143, 0.151, 0.163, 0.175, 0.198, 0.172, 0.168, 0.174], wacc: [0.082, 0.082, 0.083, 0.084, 0.084, 0.085, 0.086, 0.087, 0.087, 0.088], roe: [0.21, 0.24, 0.28, 0.26, 0.25, 0.24, 0.29, 0.22, 0.19, 0.2], margin: [0.28, 0.27, 0.3, 0.25, 0.24, 0.25, 0.4, 0.34, 0.26, 0.27], turnover: [0.49, 0.52, 0.56, 0.58, 0.6, 0.61, 0.63, 0.62, 0.59, 0.6], equity: [1.52, 1.68, 1.71, 1.79, 1.76, 1.58, 1.15, 1.05, 1.12, 1.1], fcf: [26500, 38200, 65800, 71000, 85000, 109000, 167000, 146000, 128000, 152000] }),
      cumulative: YEARS.map((y, i) => ({ year: y, cumulative_net_income: [29108, 70555, 142065, 219534, 312844, 435586, 660408, 848651, 1008498, 1183621][i], cumulative_fcf: [26500, 64700, 130500, 201500, 286500, 395500, 562500, 708500, 836500, 988500][i] })),
      retained_roi_percent: 138,
    },
    financialStatements: {
      income_statement: buildIncome(YEARS, [102863, 151938, 237760, 312694, 377289, 482064, 560118, 554552, 609015, 652300], [29108, 41447, 71510, 77469, 93310, 122742, 224822, 188243, 159847, 175123]),
      balance_sheet: buildBalance(YEARS, [102863, 151938, 237760, 312694, 377289, 482064, 560118, 554552, 609015, 652300]),
      cash_flow: buildCashflow(YEARS, [29108, 41447, 71510, 77469, 93310, 122742, 224822, 188243, 159847, 175123], [26500, 38200, 65800, 71000, 85000, 109000, 167000, 146000, 128000, 152000]),
    },
    fraudSignals: [
      { id: "t1", level: "medium", title: "投资收益波动风险", detail: "公允价值变动对利润扰动较大，需关注核心经营利润。", evidence: ["非IFRS口径对比"] },
    ],
    macroSnapshot: { source: "东财+FRED", available: true, note: "国内需求修复温和", indicators: [{ id: "cn_m2", name: "M2同比", value: 8.4, unit: "%" }, { id: "pmi", name: "制造业PMI", value: 50.9 }] },
    dataQuality: { source: "multi-source", missingMetrics: [], fiscalYearCount: 10, fallbackNotice: "无", lastRefreshAt: "2026-04-30T09:59:00+08:00" },
    supplementaryData: {
      prices: { source: "Longbridge", available: true, latest: 398.6, currency: "HKD", latestDate: "2026-04-29", return12m: 0.18 },
      news: { source: "Yahoo+东财", available: true, count: 41, items: [{ date: "2026-04-29", headline: "腾讯披露回购进展", source: "港交所" }] },
      announcements: { source: "港交所", available: true, count: 22, items: [{ date: "2026-04-23", title: "季度业绩公告", source: "HKEX" }] },
      industry: { source: "东财行业", available: true, peers: ["9988.HK", "3690.HK", "9618.HK"], industryName: "互联网平台" },
      sourceTrace: [
        { channel: "prices", provider: "Longbridge", status: "ok", note: "行情可用" },
        { channel: "news", provider: "Yahoo", status: "ok", note: "资讯可用" },
        { channel: "announcements", provider: "HKEX", status: "ok", note: "公告可用" },
        { channel: "industry", provider: "东财", status: "ok", note: "行业温度可用" },
      ],
      compliance: { strictNoEstimate: true, policy: "缺失数据显式提示，禁止估算" },
    },
    evidenceAnchors: [
      { id: "te1", sectionTitle: "投资要点", claim: "视频号商业化提升", year: "2024", metric: "广告收入增速", value: "+24%", source: "公司公告" },
      { id: "te2", sectionTitle: "基本面", claim: "ROIC-WACC为正", year: "2024", metric: "ROIC-WACC", value: "8.6pct", source: "财报+模型" },
    ],
  },
  "demo-catl": {
    id: "demo-catl",
    title: "宁德时代（300750.SZ）机构级中文研报（演示）",
    generatedAt: "2026-04-30T10:20:00+08:00",
    lang: "zh-CN",
    stock: { code: "300750.SZ", name: "宁德时代", shortName: "宁德", market: "CN" },
    sections: [
      { title: "投资要点", content: "评级：标配，目标价区间 220-265 元。\n预期差：市场担忧价格战拖累盈利，而我们看到成本曲线下移与储能占比提升改善盈利结构。\n催化剂：海外订单兑现、储能出货提升、新技术路线商业化。" },
      { title: "基本面", content: "宏观映射：新能源链条进入结构分化阶段，龙头集中度提升。\n十年财务检验：ROIC 大部分年份高于 WACC，但近两年剪刀差收窄。\n杜邦趋势：ROE 驱动从高毛利转向规模效率，需警惕价格竞争。" },
      { title: "估值模型", content: "分业务估值：动力电池、储能电池、材料回收分部估值。\nDCF 假设强调资本开支纪律与现金流回正质量。\n情景估值：牛市 290 / 基准 245 / 熊市 190 元。" },
      { title: "行业比较", content: "行业利润池向技术与交付能力头部集中。\n海外竞争中，供应链韧性和产线效率是关键。" },
      { title: "消息面", content: "高频订单与招投标数据显示储能业务景气改善。\n市场情绪由悲观修复到中性。" },
      { title: "风险", content: "原材料价格波动；\n海外贸易壁垒；\n技术迭代不及预期。" },
      { title: "结论", content: "当前估值处于历史中枢偏下，建议分批布局并紧盯现金流兑现。" },
    ],
    charts: [{ key: "cash_profit", title: "现金流与利润对比" }],
    disclaimer: DISCLAIMER,
    deepDiveSignals: {
      yearly: buildYearly({ years: YEARS, revenue: [57, 148, 200, 296, 457, 503, 1304, 3286, 4009, 3850], netIncome: [9, 30, 34, 34, 46, 56, 159, 307, 441, 418], roic: [0.09, 0.121, 0.132, 0.145, 0.16, 0.149, 0.184, 0.192, 0.176, 0.169], wacc: [0.081, 0.082, 0.083, 0.083, 0.084, 0.085, 0.086, 0.087, 0.088, 0.089], roe: [0.11, 0.18, 0.16, 0.13, 0.11, 0.1, 0.19, 0.24, 0.26, 0.21], margin: [0.158, 0.203, 0.171, 0.114, 0.101, 0.111, 0.122, 0.093, 0.11, 0.109], turnover: [0.72, 0.83, 0.78, 0.76, 0.82, 0.79, 1.01, 1.19, 1.14, 1.07], equity: [0.95, 1.08, 1.21, 1.47, 1.3, 1.14, 1.55, 1.69, 1.78, 1.83], fcf: [3, 11, 15, 10, 12, 8, 42, 95, 138, 120] }),
      cumulative: YEARS.map((y, i) => ({ year: y, cumulative_net_income: [9, 39, 73, 107, 153, 209, 368, 675, 1116, 1534][i], cumulative_fcf: [3, 14, 29, 39, 51, 59, 101, 196, 334, 454][i] })),
      retained_roi_percent: 122,
    },
    financialStatements: {
      income_statement: buildIncome(YEARS, [57, 148, 200, 296, 457, 503, 1304, 3286, 4009, 3850], [9, 30, 34, 34, 46, 56, 159, 307, 441, 418]),
      balance_sheet: buildBalance(YEARS, [57, 148, 200, 296, 457, 503, 1304, 3286, 4009, 3850]),
      cash_flow: buildCashflow(YEARS, [9, 30, 34, 34, 46, 56, 159, 307, 441, 418], [3, 11, 15, 10, 12, 8, 42, 95, 138, 120]),
    },
    fraudSignals: [
      { id: "c1", level: "high", title: "利润与现金流偏离", detail: "扩产高峰期累计 FCF 显著低于累计净利润，需持续监控资本开支回报。", evidence: ["2018-2021扩产周期"] },
    ],
    macroSnapshot: { source: "东财宏观", available: true, note: "国内制造业景气边际修复", indicators: [{ id: "pmi", name: "制造业PMI", value: 50.9 }, { id: "ppi", name: "PPI同比", value: -0.8, unit: "%" }] },
    dataQuality: { source: "multi-source", missingMetrics: [], fiscalYearCount: 10, fallbackNotice: "无", lastRefreshAt: "2026-04-30T10:00:00+08:00" },
    supplementaryData: {
      prices: { source: "Tushare", available: true, latest: 208.6, currency: "CNY", latestDate: "2026-04-29", return12m: 0.16 },
      news: { source: "东财+Yahoo", available: true, count: 28, items: [{ date: "2026-04-27", headline: "储能订单增长超预期", source: "东财" }] },
      announcements: { source: "巨潮资讯", available: true, count: 19, items: [{ date: "2026-04-21", title: "年报披露", source: "巨潮" }] },
      industry: { source: "东财行业", available: true, peers: ["300014.SZ", "002594.SZ", "688005.SH"], industryName: "动力电池" },
      sourceTrace: [
        { channel: "prices", provider: "Tushare", status: "ok", note: "A股行情可用" },
        { channel: "news", provider: "东财", status: "ok", note: "资讯可用" },
        { channel: "announcements", provider: "巨潮", status: "ok", note: "公告可用" },
        { channel: "industry", provider: "东财", status: "ok", note: "行业可用" },
      ],
      compliance: { strictNoEstimate: true, policy: "缺失数据显式提示，禁止估算" },
    },
    evidenceAnchors: [
      { id: "ce1", sectionTitle: "风险", claim: "扩产期现金流承压", year: "2018-2021", metric: "累计FCF/累计净利润", value: "0.28x", source: "现金流量表" },
      { id: "ce2", sectionTitle: "基本面", claim: "ROIC 仍高于 WACC", year: "2024", metric: "ROIC-WACC", value: "8.0pct", source: "财报+模型" },
    ],
  },
};

export const DEMO_REPORT_IDS = Object.keys(demoReportsRaw);

export function getDemoReportById(reportId: string): InstitutionalReport | null {
  const found = demoReportsRaw[reportId];
  if (!found) return null;
  return normalizeChineseInstitutionalReport(found);
}

export function getDemoReportSummaries() {
  return DEMO_REPORT_IDS.map((id) => {
    const report = demoReportsRaw[id];
    return {
      id,
      title: report.title,
      stockName: report.stock.name,
      stockCode: report.stock.code,
      market: report.stock.market,
      generatedAt: report.generatedAt,
      teaser: report.sections[0]?.content.split("。")?.[0] || "机构级中文研报演示",
    };
  });
}
