import type { SupportedMarket } from "./types";
import { getSupabaseAdmin } from "../server/supabase-admin";

export interface FinancialWindow {
  years: number;
  rows: Array<Record<string, unknown>>;
}

export interface FraudSignal {
  id: string;
  level: "low" | "medium" | "high";
  title: string;
  detail: string;
  evidence: string[];
}

export interface MacroSnapshot {
  source: string;
  available: boolean;
  note: string;
  m1_latest?: number | null;
  m2_latest?: number | null;
  updated_at?: string | null;
  indicators?: Array<{
    id: string;
    name: string;
    value: number | null;
    unit?: string;
    asOfDate?: string | null;
  }>;
}

export interface SupplementaryDataSnapshot {
  prices: {
    source: string;
    available: boolean;
    latest?: number | null;
    currency?: string | null;
    latestDate?: string | null;
    return1m?: number | null;
    return3m?: number | null;
    return12m?: number | null;
    note?: string;
  };
  news: {
    source: string;
    available: boolean;
    count: number;
    items: Array<{ date: string; headline: string; summary?: string; url?: string; source?: string }>;
    note?: string;
  };
  announcements: {
    source: string;
    available: boolean;
    count: number;
    items: Array<{ date: string; title: string; url?: string; source?: string }>;
    note?: string;
  };
  industry: {
    source: string;
    available: boolean;
    peers: string[];
    industryName?: string;
    industryPulse?: {
      source: string;
      boardCode?: string;
      boardName?: string;
      changePct?: number | null;
      mainNetInflow?: number | null;
      leadingCount?: number | null;
      fallingCount?: number | null;
      asOf?: string | null;
      note?: string;
    };
    industryNews?: {
      source: string;
      available: boolean;
      count: number;
      items: Array<{ date: string; headline: string; summary?: string; url?: string; source?: string }>;
      note?: string;
    };
    peerSnapshots?: Array<{
      symbol: string;
      latest?: number | null;
      return12m?: number | null;
      marketCap?: number | null;
      source?: string;
    }>;
    note?: string;
  };
  sourceTrace?: Array<{
    channel: "prices" | "news" | "announcements" | "industry";
    provider: string;
    status: "ok" | "missing" | "error";
    note: string;
  }>;
  compliance?: {
    strictNoEstimate: boolean;
    policy: string;
  };
}

export interface FinancialSnapshotPack {
  symbol: string;
  market: SupportedMarket;
  yahooSymbol: string;
  years: number;
  rows: Array<Record<string, unknown>>;
  statements: {
    income_statement: Array<Record<string, unknown>>;
    balance_sheet: Array<Record<string, unknown>>;
    cash_flow: Array<Record<string, unknown>>;
  };
  fraudSignals: FraudSignal[];
  macro: MacroSnapshot;
  supplementary: SupplementaryDataSnapshot;
  dataQuality: {
    source: string;
    missingMetrics: string[];
    fiscalYearCount: number;
    fallbackNotice: string;
    lastRefreshAt: string;
  };
}

type PriceSnapshot = SupplementaryDataSnapshot["prices"];

interface ProviderAttempt {
  provider: string;
  available: boolean;
  note: string;
}

interface YahooTimeseriesResult {
  meta?: { type?: string[] };
  [metric: string]: unknown;
}

interface YearRow {
  fiscal_year: number;
  revenue: number;
  gross_profit: number;
  operating_income: number;
  net_income: number;
  diluted_eps: number;
  operating_cash_flow: number;
  capex: number;
  free_cash_flow: number;
  total_assets: number;
  stockholders_equity: number;
  total_debt: number;
  current_assets: number;
  current_liabilities: number;
  accounts_receivable: number;
  inventory: number;
  retained_earnings: number;
  market_cap: number;
  tax_rate: number;
  interest_expense: number;
  net_margin: number;
  asset_turnover: number;
  equity_multiplier: number;
  roe: number;
  roic: number;
  wacc: number;
}

const SNAPSHOT_TTL_MINUTES = Number(process.env.FINANCIAL_SNAPSHOT_TTL_MINUTES || 360);
const LOOKBACK_YEARS = Number(process.env.FINANCIAL_LOOKBACK_YEARS || 12);

const YAHOO_METRICS = [
  "annualTotalRevenue",
  "annualGrossProfit",
  "annualOperatingIncome",
  "annualNetIncome",
  "annualDilutedEPS",
  "annualOperatingCashFlow",
  "annualCapitalExpenditure",
  "annualFreeCashFlow",
  "annualTotalAssets",
  "annualStockholdersEquity",
  "annualTotalDebt",
  "annualCurrentAssets",
  "annualCurrentLiabilities",
  "annualAccountsReceivable",
  "annualNetReceivables",
  "annualInventory",
  "annualRetainedEarnings",
  "annualMarketCap",
  "annualTaxRateForCalcs",
  "annualInterestExpense",
] as const;

function toYahooSymbol(stockCode: string, market: SupportedMarket): string {
  const upper = stockCode.trim().toUpperCase();
  if (market === "US") {
    return upper;
  }
  if (market === "HK") {
    if (upper.endsWith(".HK")) return upper;
    const digits = upper.replace(/[^0-9]/g, "").padStart(4, "0");
    return `${digits}.HK`;
  }
  if (upper.endsWith(".SH")) {
    return `${upper.slice(0, -3)}.SS`;
  }
  if (upper.endsWith(".SZ")) {
    return upper;
  }
  if (/^\d{6}$/.test(upper)) {
    if (upper.startsWith("6") || upper.startsWith("9")) return `${upper}.SS`;
    return `${upper}.SZ`;
  }
  return upper;
}

function toSinaRealtimeSymbol(stockCode: string, market: SupportedMarket): string {
  const upper = stockCode.trim().toUpperCase();
  if (market === "US") {
    return `gb_${upper.toLowerCase()}`;
  }
  if (market === "HK") {
    const digits = upper.replace(/[^0-9]/g, "").padStart(5, "0");
    return `rt_hk${digits}`;
  }
  const digits = upper.replace(/[^0-9]/g, "");
  if (/^\d{6}$/.test(digits)) {
    if (digits.startsWith("6") || digits.startsWith("9")) return `sh${digits}`;
    return `sz${digits}`;
  }
  return upper.toLowerCase();
}

function toTushareTsCode(symbol: string, market: SupportedMarket): string | null {
  const upper = symbol.trim().toUpperCase();
  if (market === "US") return null;
  if (market === "HK") {
    const digits = upper.replace(/[^0-9]/g, "").padStart(5, "0");
    return `${digits}.HK`;
  }
  const digits = upper.replace(/[^0-9]/g, "").slice(0, 6);
  if (!/^\d{6}$/.test(digits)) return null;
  if (digits.startsWith("6") || digits.startsWith("9")) return `${digits}.SH`;
  return `${digits}.SZ`;
}

function chunked<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size) as T[]);
  }
  return out;
}

function asNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function estimateWacc(row: YearRow): number {
  // 保守估算：在缺乏完整资本成本曲线时，给出可解释的经验区间估值。
  const tax = row.tax_rate > 0 && row.tax_rate < 0.5 ? row.tax_rate : 0.2;
  const debtWeight = safeDivide(row.total_debt, row.total_debt + row.stockholders_equity);
  const equityWeight = 1 - debtWeight;
  const equityCost = 0.09;
  const debtCost = 0.055;
  const wacc = equityWeight * equityCost + debtWeight * debtCost * (1 - tax);
  return Math.max(0.05, Math.min(0.14, wacc));
}

function buildRow(year: number, metrics: Record<string, number>): YearRow {
  const revenue = metrics.annualTotalRevenue || 0;
  const operatingIncome = metrics.annualOperatingIncome || 0;
  const netIncome = metrics.annualNetIncome || 0;
  const ocf = metrics.annualOperatingCashFlow || 0;
  const capexRaw = metrics.annualCapitalExpenditure || 0;
  const capex = capexRaw > 0 ? -Math.abs(capexRaw) : capexRaw;
  const fcf = metrics.annualFreeCashFlow || ocf + capex;
  const totalAssets = metrics.annualTotalAssets || 0;
  const equity = metrics.annualStockholdersEquity || 0;
  const totalDebt = metrics.annualTotalDebt || 0;
  const taxRate = metrics.annualTaxRateForCalcs || 0;
  const nopat = operatingIncome * (1 - (taxRate > 0 && taxRate < 0.5 ? taxRate : 0.2));
  const investedCapital = totalDebt + equity;

  const row: YearRow = {
    fiscal_year: year,
    revenue,
    gross_profit: metrics.annualGrossProfit || 0,
    operating_income: operatingIncome,
    net_income: netIncome,
    diluted_eps: metrics.annualDilutedEPS || 0,
    operating_cash_flow: ocf,
    capex,
    free_cash_flow: fcf,
    total_assets: totalAssets,
    stockholders_equity: equity,
    total_debt: totalDebt,
    current_assets: metrics.annualCurrentAssets || 0,
    current_liabilities: metrics.annualCurrentLiabilities || 0,
    accounts_receivable: metrics.annualAccountsReceivable || metrics.annualNetReceivables || 0,
    inventory: metrics.annualInventory || 0,
    retained_earnings: metrics.annualRetainedEarnings || 0,
    market_cap: metrics.annualMarketCap || 0,
    tax_rate: taxRate,
    interest_expense: metrics.annualInterestExpense || 0,
    net_margin: safeDivide(netIncome, revenue),
    asset_turnover: safeDivide(revenue, totalAssets),
    equity_multiplier: safeDivide(totalAssets, equity),
    roe: safeDivide(netIncome, equity),
    roic: safeDivide(nopat, investedCapital),
    wacc: 0,
  };
  row.wacc = estimateWacc(row);
  return row;
}

function growthRate(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return (current - previous) / Math.abs(previous);
}

function buildFraudSignals(rows: YearRow[]): FraudSignal[] {
  const signals: FraudSignal[] = [];
  if (rows.length < 2) return signals;

  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  let cumulativeProfit = 0;
  let cumulativeFcf = 0;
  for (const row of rows) {
    cumulativeProfit += row.net_income;
    cumulativeFcf += row.free_cash_flow;
  }
  const cashConversion = safeDivide(cumulativeFcf, cumulativeProfit || 1);
  if (cumulativeProfit > 0 && cashConversion < 0.3) {
    signals.push({
      id: "cash_conversion_low",
      level: cashConversion < 0 ? "high" : "medium",
      title: "现金含金量偏低",
      detail:
        "累计自由现金流显著低于累计净利润，存在利润质量偏弱风险，需重点核对应收、存货和资本化口径。",
      evidence: [
        `累计净利润=${cumulativeProfit.toFixed(2)}`,
        `累计FCF=${cumulativeFcf.toFixed(2)}`,
        `现金含金量=${(cashConversion * 100).toFixed(2)}%`,
      ],
    });
  }

  const revGrowth = growthRate(latest.revenue, prev.revenue);
  const receivableGrowth = growthRate(latest.accounts_receivable, prev.accounts_receivable);
  if (latest.accounts_receivable > 0 && receivableGrowth - revGrowth > 0.2) {
    signals.push({
      id: "receivable_outgrow_revenue",
      level: "high",
      title: "应收增速显著快于营收",
      detail: "应收账款增速显著快于收入增速，存在提前确认收入或回款恶化风险。",
      evidence: [
        `${prev.fiscal_year}->${latest.fiscal_year} 营收增速=${(revGrowth * 100).toFixed(2)}%`,
        `${prev.fiscal_year}->${latest.fiscal_year} 应收增速=${(receivableGrowth * 100).toFixed(2)}%`,
      ],
    });
  }

  const invGrowth = growthRate(latest.inventory, prev.inventory);
  if (latest.inventory > 0 && invGrowth - revGrowth > 0.2) {
    signals.push({
      id: "inventory_outgrow_revenue",
      level: "medium",
      title: "存货增速偏高",
      detail: "存货增速明显高于收入增速，可能存在渠道压货或需求转弱风险。",
      evidence: [
        `${prev.fiscal_year}->${latest.fiscal_year} 营收增速=${(revGrowth * 100).toFixed(2)}%`,
        `${prev.fiscal_year}->${latest.fiscal_year} 存货增速=${(invGrowth * 100).toFixed(2)}%`,
      ],
    });
  }

  const accrual = safeDivide(latest.net_income - latest.operating_cash_flow, latest.total_assets || 1);
  if (accrual > 0.08) {
    signals.push({
      id: "high_accrual_ratio",
      level: "medium",
      title: "应计利润占比偏高",
      detail: "净利润明显高于经营现金流，对应计科目的依赖偏高，建议核验利润可持续性。",
      evidence: [
        `${latest.fiscal_year} 净利润=${latest.net_income.toFixed(2)}`,
        `${latest.fiscal_year} 经营现金流=${latest.operating_cash_flow.toFixed(2)}`,
        `${latest.fiscal_year} 应计比例=${(accrual * 100).toFixed(2)}%`,
      ],
    });
  }

  const leverageRise = latest.equity_multiplier - prev.equity_multiplier;
  const marginDrop = latest.net_margin - prev.net_margin;
  if (leverageRise > 0.3 && marginDrop < -0.01) {
    signals.push({
      id: "dupont_quality_downgrade",
      level: "high",
      title: "杜邦质量降级风险",
      detail: "ROE 维持主要依赖杠杆提升而非盈利质量改善，需警惕质量型下滑。",
      evidence: [
        `${prev.fiscal_year}->${latest.fiscal_year} 权益乘数变化=${leverageRise.toFixed(2)}`,
        `${prev.fiscal_year}->${latest.fiscal_year} 净利率变化=${(marginDrop * 100).toFixed(2)}%`,
      ],
    });
  }

  return signals;
}

function computeDeepDiveSignals(rows: YearRow[]) {
  let cumulativeProfit = 0;
  let cumulativeFcf = 0;

  const cumulative = rows.map((item) => {
    cumulativeProfit += item.net_income;
    cumulativeFcf += item.free_cash_flow;
    return {
      year: item.fiscal_year,
      cumulative_net_income: cumulativeProfit,
      cumulative_fcf: cumulativeFcf,
    };
  });

  const first = rows[0];
  const last = rows[rows.length - 1];
  const retainedSum = rows.reduce((sum, row) => sum + row.retained_earnings, 0);
  const retainedRoi =
    retainedSum > 0 && first && last
      ? Number((((last.market_cap - first.market_cap) / retainedSum) * 100).toFixed(2))
      : null;

  return {
    yearly: rows.map((r) => ({ ...r })),
    cumulative,
    retained_roi_percent: retainedRoi,
    value_creation_years: rows.filter((y) => y.roic > y.wacc).map((y) => y.fiscal_year),
    value_destruction_years: rows.filter((y) => y.roic <= y.wacc).map((y) => y.fiscal_year),
  };
}

function selectWindow(rows: YearRow[]): YearRow[] {
  if (rows.length >= 10) return rows.slice(-10);
  if (rows.length >= 5) return rows.slice(-5);
  return rows.slice(-Math.min(3, rows.length));
}

async function fetchWithTimeout(url: string, timeoutMs = 20000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "User-Agent": "AIFinView/1.0",
      ...(typeof init?.headers === "object" ? (init.headers as Record<string, string>) : {}),
    };
    return await fetch(url, {
      method: init?.method || "GET",
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYahooTimeseries(yahooSymbol: string): Promise<{ rows: YearRow[]; missingMetrics: string[] }> {
  const now = new Date();
  const start = new Date(now.getFullYear() - LOOKBACK_YEARS, 0, 1);
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(now.getTime() / 1000);
  const metricChunks = chunked(YAHOO_METRICS, 8);
  const yearMetricMap = new Map<number, Record<string, number>>();
  const observedMetrics = new Set<string>();

  for (const metricChunk of metricChunks) {
    const typeParam = encodeURIComponent(metricChunk.join(","));
    const url =
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
        yahooSymbol,
      )}` +
      `?lang=en-US&region=US&symbol=${encodeURIComponent(yahooSymbol)}&type=${typeParam}` +
      `&merge=false&padTimeSeries=true&period1=${period1}&period2=${period2}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      continue;
    }
    const data = (await response.json()) as { timeseries?: { result?: YahooTimeseriesResult[] } };
    const result = data.timeseries?.result || [];

    for (const item of result) {
      const metric = item.meta?.type?.[0];
      if (!metric) continue;
      const entries = item[metric];
      if (!Array.isArray(entries)) continue;

      observedMetrics.add(metric);
      for (const entry of entries as Array<Record<string, unknown>>) {
        const date = String(entry.asOfDate || "");
        const year = Number(date.slice(0, 4));
        const raw = asNumber((entry.reportedValue as { raw?: number } | undefined)?.raw);
        if (!year || !Number.isFinite(raw)) continue;
        const target = yearMetricMap.get(year) || {};
        target[metric] = raw;
        yearMetricMap.set(year, target);
      }
    }
  }

  const years = Array.from(yearMetricMap.keys()).sort((a, b) => a - b);
  const rows = years.map((year) => buildRow(year, yearMetricMap.get(year) || {})).filter((row) => row.revenue !== 0);

  const missingMetrics = YAHOO_METRICS.filter((key) => !observedMetrics.has(key));
  return { rows, missingMetrics };
}

function toSinaPaperCode(symbol: string, market: SupportedMarket): string | null {
  const upper = symbol.trim().toUpperCase();
  if (market === "CN") {
    const digits = upper.replace(/[^0-9]/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(digits)) return null;
    const prefix = digits.startsWith("6") || digits.startsWith("9") ? "sh" : "sz";
    return `${prefix}${digits}`;
  }
  if (market === "HK") {
    const digits = upper.replace(/[^0-9]/g, "").padStart(5, "0");
    return `hk${digits}`;
  }
  return null;
}

async function fetchSinaFinanceReport(
  paperCode: string,
  source: "lrb" | "fzb" | "llb",
): Promise<{ reportDate: string; values: Record<string, number> } | null> {
  try {
    const url =
      `https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022` +
      `?paperCode=${encodeURIComponent(paperCode)}&source=${source}`;
    const resp = await fetchWithTimeout(url, 25000, {
      headers: { Referer: "https://finance.sina.com.cn" },
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      result?: {
        status?: { code?: number };
        data?: {
          report_list?: Record<
            string,
            {
              data?: Array<{
                item_field?: string;
                item_value?: string | number | null;
              }>;
            }
          >;
        } | null;
      };
    };
    if (json.result?.status?.code !== 0) return null;
    const reportList = json.result?.data?.report_list;
    if (!reportList) return null;
    const keys = Object.keys(reportList).sort((a, b) => b.localeCompare(a));
    const latestKey = keys[0];
    if (!latestKey) return null;
    const row = reportList[latestKey];
    const values: Record<string, number> = {};
    for (const item of row?.data || []) {
      const field = String(item.item_field || "").trim().toUpperCase();
      if (!field) continue;
      const val = asNullableNumber(item.item_value);
      if (val === null) continue;
      values[field] = val;
    }
    return { reportDate: latestKey, values };
  } catch {
    return null;
  }
}

async function fetchSinaTimeseriesFallback(symbol: string, market: SupportedMarket): Promise<{
  rows: YearRow[];
  missingMetrics: string[];
}> {
  const paperCode = toSinaPaperCode(symbol, market);
  if (!paperCode) {
    return { rows: [], missingMetrics: ["sina_paper_code"] };
  }
  const [income, balance, cashflow] = await Promise.all([
    fetchSinaFinanceReport(paperCode, "lrb"),
    fetchSinaFinanceReport(paperCode, "fzb"),
    fetchSinaFinanceReport(paperCode, "llb"),
  ]);
  if (!income || !balance || !cashflow) {
    return { rows: [], missingMetrics: ["sina_lrb_or_fzb_or_llb_missing"] };
  }
  const year = Number(String(income.reportDate).slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) {
    return { rows: [], missingMetrics: ["sina_invalid_year"] };
  }
  const row = buildRow(year, {
    annualTotalRevenue: income.values.BIZTOTINCO || income.values.BIZINCO || 0,
    annualGrossProfit: (income.values.BIZTOTINCO || 0) - (income.values.BIZCOST || 0),
    annualOperatingIncome: income.values.OPERATEPROFIT || 0,
    annualNetIncome: income.values.PARENETP || income.values.NETPROFIT || 0,
    annualDilutedEPS: income.values.DILUTEDEPS || income.values.BASICEPS || 0,
    annualOperatingCashFlow: cashflow.values.MANANETR || 0,
    annualCapitalExpenditure: -Math.abs(cashflow.values.ACQUASSETCASH || 0),
    annualFreeCashFlow:
      (cashflow.values.MANANETR || 0) - Math.abs(cashflow.values.ACQUASSETCASH || 0),
    annualTotalAssets: balance.values.TOTASSET || 0,
    annualStockholdersEquity: balance.values.PARESHARRIGH || balance.values.TOTSHAREQUI || 0,
    annualTotalDebt: balance.values.TOTLIAB || 0,
    annualCurrentAssets: balance.values.TOTALCURRASSET || 0,
    annualCurrentLiabilities: balance.values.TOTALCURRLIAB || 0,
    annualAccountsReceivable: balance.values.ACCORECE || 0,
    annualInventory: balance.values.INVENTORY || 0,
    annualRetainedEarnings: balance.values.RETAINPROFIT || 0,
    annualInterestExpense: income.values.FINANCEEXP || 0,
  });
  return { rows: [row], missingMetrics: [] };
}

async function fetchFinancialRowsWithFallback(
  symbol: string,
  market: SupportedMarket,
  yahooSymbol: string,
): Promise<{ rows: YearRow[]; missingMetrics: string[]; source: string; attempts: ProviderAttempt[] }> {
  const attempts: ProviderAttempt[] = [];

  const yahoo = await fetchYahooTimeseries(yahooSymbol);
  attempts.push({
    provider: "yfinance_yahoo_timeseries",
    available: yahoo.rows.length > 0,
    note: yahoo.rows.length > 0 ? `rows=${yahoo.rows.length}` : "empty",
  });
  if (yahoo.rows.length > 0) {
    return {
      rows: yahoo.rows,
      missingMetrics: yahoo.missingMetrics,
      source: "yfinance_yahoo_timeseries",
      attempts,
    };
  }

  // A/H 股补链路：Sina 财报接口（AkShare 常见同源接口）
  if (market === "CN" || market === "HK") {
    const sina = await fetchSinaTimeseriesFallback(symbol, market);
    attempts.push({
      provider: "akshare_sina_finance",
      available: sina.rows.length > 0,
      note: sina.rows.length > 0 ? `rows=${sina.rows.length}` : "empty",
    });
    if (sina.rows.length > 0) {
      return {
        rows: sina.rows,
        missingMetrics: sina.missingMetrics,
        source: "akshare_sina_finance",
        attempts,
      };
    }
  }

  // Tushare / Longbridge 通道在当前纯 Vercel Node 版本仅保留占位，不强制依赖密钥。
  attempts.push({
    provider: "tushare_http",
    available: false,
    note: process.env.TUSHARE_TOKEN || process.env.TUSHARE_API_TOKEN ? "reserved" : "token_missing",
  });
  attempts.push({
    provider: "longbridge_openapi",
    available: false,
    note:
      process.env.LONGBRIDGE_APP_KEY &&
      process.env.LONGBRIDGE_APP_SECRET &&
      process.env.LONGBRIDGE_ACCESS_TOKEN
        ? "reserved"
        : "credential_missing",
  });

  return {
    rows: [],
    missingMetrics: [...YAHOO_METRICS],
    source: "none",
    attempts,
  };
}

async function fetchYahooPriceSnapshot(yahooSymbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol,
    )}?range=1y&interval=1mo`;
    const response = await fetchWithTimeout(url, 20000);
    if (!response.ok) {
      return {
        source: "yahoo_chart",
        available: false,
        latest: null,
        note: `价格接口异常: ${response.status}`,
      };
    }
    const json = (await response.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          meta?: { currency?: string };
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const points: Array<{ ts: number; close: number }> = [];
    for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
      const close = closes[i];
      if (typeof close === "number" && Number.isFinite(close)) {
        points.push({ ts: timestamps[i], close });
      }
    }
    if (points.length === 0) {
      return {
        source: "yahoo_chart",
        available: false,
        latest: null,
        note: "价格数据为空",
      };
    }
    const latest = points[points.length - 1];
    const pickPast = (monthsAgo: number) => {
      const idx = Math.max(0, points.length - 1 - monthsAgo);
      return points[idx]?.close || points[0].close;
    };
    const base1m = pickPast(1);
    const base3m = pickPast(3);
    const base12m = points[0].close;
    const ret = (curr: number, base: number) => (base > 0 ? (curr - base) / base : 0);
    return {
      source: "yahoo_chart",
      available: true,
      latest: latest.close,
      currency: result?.meta?.currency || null,
      latestDate: new Date(latest.ts * 1000).toISOString().slice(0, 10),
      return1m: ret(latest.close, base1m),
      return3m: ret(latest.close, base3m),
      return12m: ret(latest.close, base12m),
      note: "基于 Yahoo Chart 月频价格",
    };
  } catch (error) {
    return {
      source: "yahoo_chart",
      available: false,
      latest: null,
      note: `价格抓取失败: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

async function fetchSinaRealtimePriceSnapshot(symbol: string, market: SupportedMarket): Promise<PriceSnapshot> {
  try {
    const sinaSymbol = toSinaRealtimeSymbol(symbol, market);
    const url = `https://hq.sinajs.cn/list=${encodeURIComponent(sinaSymbol)}`;
    const response = await fetchWithTimeout(url, 20000, {
      headers: {
        Referer: "https://finance.sina.com.cn",
      },
    });
    if (!response.ok) {
      return {
        source: "akshare_sina_realtime",
        available: false,
        latest: null,
        note: `Sina 行情接口异常: ${response.status}`,
      };
    }
    const text = (await response.text()).trim();
    const firstQuote = text.indexOf("\"");
    const lastQuote = text.lastIndexOf("\"");
    if (firstQuote < 0 || lastQuote <= firstQuote) {
      return {
        source: "akshare_sina_realtime",
        available: false,
        latest: null,
        note: "Sina 返回格式异常",
      };
    }
    const payload = text.slice(firstQuote + 1, lastQuote);
    const parts = payload.split(",");
    if (parts.length < 4) {
      return {
        source: "akshare_sina_realtime",
        available: false,
        latest: null,
        note: "Sina 行情字段不足",
      };
    }

    let latest = 0;
    let prevClose = 0;
    if (market === "CN") {
      latest = asNumber(parts[3]);
      prevClose = asNumber(parts[2]);
    } else if (market === "HK") {
      latest = asNumber(parts[2]);
      prevClose = asNumber(parts[3]);
    } else {
      latest = asNumber(parts[1]);
      const changeAmount = asNumber(parts[4]);
      prevClose = latest - changeAmount;
    }
    if (latest <= 0) latest = asNumber(parts[1]);
    if (prevClose <= 0) prevClose = asNumber(parts[2]) || asNumber(parts[1]);
    const dateToken =
      parts.find((item) => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(item)) ||
      parts.find((item) => /^\d{4}[-/]\d{2}[-/]\d{2}\s/.test(item)) ||
      "";
    const latestDate = dateToken ? dateToken.replace(/\//g, "-") : null;
    return {
      source: "akshare_sina_realtime",
      available: latest > 0,
      latest: latest > 0 ? latest : null,
      latestDate,
      return1m: null,
      return3m: null,
      return12m: prevClose > 0 && latest > 0 ? (latest - prevClose) / prevClose : null,
      note: latest > 0 ? "Sina 实时行情（AkShare 同源）" : "Sina 未返回有效价格",
    };
  } catch (error) {
    return {
      source: "akshare_sina_realtime",
      available: false,
      latest: null,
      note: `Sina 行情抓取失败: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

async function fetchEastmoneyPriceSnapshot(symbol: string, market: SupportedMarket): Promise<PriceSnapshot> {
  if (market !== "CN") {
    return {
      source: "akshare_eastmoney_quote",
      available: false,
      latest: null,
      note: "东财报价接口当前仅接入A股",
    };
  }
  const digits = symbol.toUpperCase().replace(/[^0-9]/g, "").slice(0, 6);
  if (!/^\d{6}$/.test(digits)) {
    return {
      source: "akshare_eastmoney_quote",
      available: false,
      latest: null,
      note: `A股代码格式不合法: ${symbol}`,
    };
  }
  const marketCode = digits.startsWith("6") || digits.startsWith("9") ? "1" : "0";
  const secid = `${marketCode}.${digits}`;
  try {
    const url =
      `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}` +
      `&fields=f43,f44,f45,f46,f60,f58,f116,f117`;
    const resp = await fetchWithTimeout(url, 20000);
    if (!resp.ok) {
      return {
        source: "akshare_eastmoney_quote",
        available: false,
        latest: null,
        note: `东财报价接口异常: ${resp.status}`,
      };
    }
    const json = (await resp.json()) as {
      data?: {
        f43?: number; // 最新价 * 100
        f60?: number; // 昨收 * 100
      };
    };
    const latest = asNumber(json.data?.f43) / 100;
    const prevClose = asNumber(json.data?.f60) / 100;
    return {
      source: "akshare_eastmoney_quote",
      available: latest > 0,
      latest: latest > 0 ? latest : null,
      latestDate: new Date().toISOString().slice(0, 10),
      return1m: null,
      return3m: null,
      return12m: prevClose > 0 && latest > 0 ? (latest - prevClose) / prevClose : null,
      note: latest > 0 ? "东方财富实时行情（AkShare 同源）" : "东财未返回有效价格",
    };
  } catch (error) {
    return {
      source: "akshare_eastmoney_quote",
      available: false,
      latest: null,
      note: `东财报价抓取失败: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

async function fetchTusharePriceSnapshot(symbol: string, market: SupportedMarket): Promise<PriceSnapshot> {
  const token = process.env.TUSHARE_TOKEN || process.env.TUSHARE_API_TOKEN;
  if (!token) {
    return {
      source: "tushare_http",
      available: false,
      latest: null,
      note: "未配置 TUSHARE_TOKEN，跳过 Tushare 通道",
    };
  }
  const tsCode = toTushareTsCode(symbol, market);
  if (!tsCode) {
    return {
      source: "tushare_http",
      available: false,
      latest: null,
      note: "当前市场/代码无法映射到 Tushare ts_code",
    };
  }
  try {
    const body = JSON.stringify({
      api_name: market === "HK" ? "hk_daily" : "daily",
      token,
      params: { ts_code: tsCode, limit: 1 },
      fields: "trade_date,close,pre_close",
    });
    const resp = await fetchWithTimeout("https://api.tushare.pro", 25000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!resp.ok) {
      return {
        source: "tushare_http",
        available: false,
        latest: null,
        note: `Tushare 接口异常: ${resp.status}`,
      };
    }
    const json = (await resp.json()) as {
      code?: number;
      msg?: string;
      data?: { fields?: string[]; items?: Array<Array<string | number | null>> };
    };
    if (json.code !== 0) {
      return {
        source: "tushare_http",
        available: false,
        latest: null,
        note: `Tushare 返回错误: ${json.msg || json.code}`,
      };
    }
    const fields = json.data?.fields || [];
    const first = json.data?.items?.[0];
    if (!first) {
      return {
        source: "tushare_http",
        available: false,
        latest: null,
        note: "Tushare 未返回行情数据",
      };
    }
    const getByField = (name: string) => {
      const idx = fields.indexOf(name);
      return idx >= 0 ? first[idx] : null;
    };
    const latest = asNumber(getByField("close"));
    const prevClose = asNumber(getByField("pre_close"));
    const tradeDateRaw = String(getByField("trade_date") || "");
    const latestDate =
      tradeDateRaw.length === 8
        ? `${tradeDateRaw.slice(0, 4)}-${tradeDateRaw.slice(4, 6)}-${tradeDateRaw.slice(6, 8)}`
        : null;
    return {
      source: "tushare_http",
      available: latest > 0,
      latest: latest > 0 ? latest : null,
      latestDate,
      return12m: prevClose > 0 && latest > 0 ? (latest - prevClose) / prevClose : null,
      note: latest > 0 ? "Tushare 日线收盘价" : "Tushare 未返回有效价格",
    };
  } catch (error) {
    return {
      source: "tushare_http",
      available: false,
      latest: null,
      note: `Tushare 抓取失败: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

async function fetchLongbridgePriceSnapshot(symbol: string, market: SupportedMarket): Promise<PriceSnapshot> {
  const appKey = process.env.LONGBRIDGE_APP_KEY;
  const appSecret = process.env.LONGBRIDGE_APP_SECRET;
  const accessToken = process.env.LONGBRIDGE_ACCESS_TOKEN;
  if (!appKey || !appSecret || !accessToken) {
    return {
      source: "longbridge_openapi",
      available: false,
      latest: null,
      note: "未配置 Longbridge 凭证，跳过 Longbridge 通道",
    };
  }
  return {
    source: "longbridge_openapi",
    available: false,
    latest: null,
    note: "当前纯 Vercel Node 版本未启用 Longbridge SDK 直连（已保留通道占位）",
  };
}

function toFinnhubSymbol(symbol: string, market: SupportedMarket): string {
  const upper = symbol.toUpperCase();
  if (market === "US") return upper;
  if (market === "CN") {
    if (upper.endsWith(".SH")) return upper.replace(".SH", ".SS");
    if (upper.endsWith(".SZ")) return upper;
    if (/^\d{6}$/.test(upper)) return upper.startsWith("6") ? `${upper}.SS` : `${upper}.SZ`;
  }
  if (market === "HK") {
    const digits = upper.replace(/[^0-9]/g, "").padStart(4, "0");
    return `${digits}.HK`;
  }
  return upper;
}

function emptyAnnouncementChannel(source: string, note: string): SupplementaryDataSnapshot["announcements"] {
  return {
    source,
    available: false,
    count: 0,
    items: [],
    note,
  };
}

function emptyNewsChannel(source: string, note: string): SupplementaryDataSnapshot["news"] {
  return {
    source,
    available: false,
    count: 0,
    items: [],
    note,
  };
}

function emptyIndustryChannel(source: string, note: string): SupplementaryDataSnapshot["industry"] {
  return {
    source,
    available: false,
    peers: [],
    industryPulse: {
      source,
      note,
    },
    industryNews: {
      source,
      available: false,
      count: 0,
      items: [],
      note,
    },
    peerSnapshots: [],
    note,
  };
}

async function fetchYahooSearchSupplementary(
  symbol: string,
  yahooSymbol: string,
): Promise<Pick<SupplementaryDataSnapshot, "news" | "industry">> {
  try {
    const searchUrl =
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}` +
      `&quotesCount=8&newsCount=12&enableFuzzyQuery=false`;
    const searchResp = await fetchWithTimeout(searchUrl, 20000);
    if (!searchResp.ok) {
      return {
        news: emptyNewsChannel("yahoo_search", `Yahoo Search 接口异常: ${searchResp.status}`),
        industry: emptyIndustryChannel("yahoo_search", "Yahoo Search 未返回行业比较字段"),
      };
    }

    const searchJson = (await searchResp.json()) as {
      news?: Array<{
        providerPublishTime?: number;
        title?: string;
        summary?: string;
        link?: string;
        publisher?: string;
      }>;
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
      }>;
    };

    const newsItems =
      (searchJson.news || [])
        .slice(0, 12)
        .map((item) => ({
          date: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString().slice(0, 10) : "",
          headline: item.title || "",
          summary: item.summary || "",
          url: item.link || "",
          source: item.publisher || "Yahoo",
        }))
        .filter((item) => item.headline) || [];

    let industryName: string | undefined;
    let peerSymbols: string[] = [];

    const quoteCandidates = searchJson.quotes || [];
    if (quoteCandidates.length > 0) {
      peerSymbols = quoteCandidates
        .map((q) => q.symbol || "")
        .filter((s) => s && s.toUpperCase() !== yahooSymbol.toUpperCase())
        .slice(0, 8);
    }

    try {
      const summaryUrl =
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}` +
        `?modules=assetProfile,price`;
      const summaryResp = await fetchWithTimeout(summaryUrl, 20000);
      if (summaryResp.ok) {
        const summaryJson = (await summaryResp.json()) as {
          quoteSummary?: {
            result?: Array<{
              assetProfile?: { industry?: string; sector?: string };
              price?: { shortName?: string; longName?: string };
            }>;
          };
        };
        const first = summaryJson.quoteSummary?.result?.[0];
        industryName = first?.assetProfile?.industry || first?.assetProfile?.sector || undefined;
      }
    } catch {
      // 忽略行业补充失败，保持缺失标记。
    }

    return {
      news: {
        source: "yahoo_search_news",
        available: newsItems.length > 0,
        count: newsItems.length,
        items: newsItems,
        note: newsItems.length ? "Yahoo Search 最近新闻" : "Yahoo Search 未返回相关新闻",
      },
      industry: {
        source: "yahoo_search+quote_summary",
        available: Boolean(industryName || peerSymbols.length > 0),
        peers: peerSymbols,
        industryName,
        peerSnapshots: [],
        note: industryName || peerSymbols.length > 0 ? "行业字段来自 Yahoo quoteSummary/search" : "未获取到行业字段",
      },
    };
  } catch (error) {
    return {
      news: emptyNewsChannel("yahoo_search", `Yahoo Search 抓取失败: ${error instanceof Error ? error.message : "unknown"}`),
      industry: emptyIndustryChannel("yahoo_search", "Yahoo Search 行业字段抓取失败"),
    };
  }
}

let secTickerCache: Map<string, string> | null = null;

async function loadSecTickerMap(): Promise<Map<string, string>> {
  if (secTickerCache) return secTickerCache;
  const resp = await fetchWithTimeout("https://www.sec.gov/files/company_tickers.json", 30000);
  if (!resp.ok) throw new Error(`SEC ticker 索引获取失败: ${resp.status}`);
  const json = (await resp.json()) as Record<string, { ticker?: string; cik_str?: number | string }>;
  const map = new Map<string, string>();
  for (const key of Object.keys(json)) {
    const item = json[key];
    const ticker = String(item.ticker || "").toUpperCase();
    const cikRaw = item.cik_str;
    const cik = String(cikRaw || "").trim();
    if (!ticker || !cik) continue;
    map.set(ticker, cik.padStart(10, "0"));
  }
  secTickerCache = map;
  return map;
}

async function fetchUsSecAnnouncements(symbol: string): Promise<SupplementaryDataSnapshot["announcements"]> {
  try {
    const tickerMap = await loadSecTickerMap();
    const cik = tickerMap.get(symbol.toUpperCase());
    if (!cik) {
      return emptyAnnouncementChannel("sec_edgar", `SEC ticker 映射缺失：${symbol}`);
    }
    const headers = {
      "User-Agent": process.env.SEC_USER_AGENT || "AIFinView/1.0 (contact: support@aifinview.local)",
      Accept: "application/json",
    };
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const resp = await fetchWithTimeout(submissionsUrl, 30000, { headers });
    if (!resp.ok) {
      return emptyAnnouncementChannel("sec_edgar", `SEC submissions 接口异常: ${resp.status}`);
    }
    const json = (await resp.json()) as {
      filings?: {
        recent?: {
          form?: string[];
          filingDate?: string[];
          accessionNumber?: string[];
          primaryDocument?: string[];
        };
      };
    };
    const recent = json.filings?.recent;
    const forms = recent?.form || [];
    const filingDates = recent?.filingDate || [];
    const accessions = recent?.accessionNumber || [];
    const primaryDocs = recent?.primaryDocument || [];
    const items: Array<{ date: string; title: string; url?: string; source?: string }> = [];
    const max = Math.min(forms.length, filingDates.length, accessions.length, primaryDocs.length, 20);
    for (let i = 0; i < max; i++) {
      const form = forms[i] || "";
      const date = filingDates[i] || "";
      const accessionRaw = accessions[i] || "";
      const accession = accessionRaw.replace(/-/g, "");
      const doc = primaryDocs[i] || "";
      if (!form || !date) continue;
      const url =
        accession && doc
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${doc}`
          : undefined;
      items.push({
        date,
        title: `SEC ${form}`,
        url,
        source: "sec_edgar",
      });
    }
    return {
      source: "sec_edgar_submissions",
      available: items.length > 0,
      count: items.length,
      items: items.slice(0, 12),
      note: items.length > 0 ? "美国公告来源：SEC EDGAR submissions" : "SEC 未返回最近公告",
    };
  } catch (error) {
    return emptyAnnouncementChannel("sec_edgar", `SEC 公告抓取失败: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

function toCnDigits(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".SH") || upper.endsWith(".SZ")) return upper.slice(0, 6);
  return upper.replace(/[^0-9]/g, "").slice(0, 6);
}

async function fetchCnEastmoneyAnnouncements(symbol: string): Promise<SupplementaryDataSnapshot["announcements"]> {
  const digits = toCnDigits(symbol);
  if (!/^\d{6}$/.test(digits)) {
    return emptyAnnouncementChannel("eastmoney_notice", `东财公告仅支持A股6位代码：${symbol}`);
  }
  try {
    const url =
      `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=12&page_index=1` +
      `&ann_type=A&client_source=web&stock_list=${digits}&f_node=0&s_node=0`;
    const resp = await fetchWithTimeout(url, 25000);
    if (!resp.ok) {
      return emptyAnnouncementChannel("eastmoney_notice", `东财公告接口异常: ${resp.status}`);
    }
    const json = (await resp.json()) as {
      data?: {
        list?: Array<{
          art_code?: string;
          notice_date?: string;
          title?: string;
          display_time?: string;
        }>;
      };
    };
    const items =
      (json.data?.list || [])
        .map((item) => {
          const artCode = item.art_code || "";
          return {
            date: (item.notice_date || item.display_time || "").slice(0, 10),
            title: item.title || "公司公告",
            url: artCode ? `https://data.eastmoney.com/notices/detail/${digits}/${artCode}.html` : "",
            source: "eastmoney_notice",
          };
        })
        .filter((item) => item.title) || [];
    return {
      source: "eastmoney_notice_list",
      available: items.length > 0,
      count: items.length,
      items,
      note: items.length > 0 ? "A股公告来源：东方财富公告接口" : "东财未返回最近公告",
    };
  } catch (error) {
    return emptyAnnouncementChannel("eastmoney_notice", `东财公告抓取失败: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

async function fetchCnEastmoneyIndustry(symbol: string): Promise<SupplementaryDataSnapshot["industry"]> {
  const digits = toCnDigits(symbol);
  if (!/^\d{6}$/.test(digits)) {
    return emptyIndustryChannel("eastmoney_quote", "东财行业字段仅支持A股");
  }
  const marketCode = digits.startsWith("6") || digits.startsWith("9") ? "1" : "0";
  const secid = `${marketCode}.${digits}`;
  try {
    const url =
      `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}` +
      `&fields=f57,f58,f127,f116,f117,f162,f43`;
    const resp = await fetchWithTimeout(url, 20000);
    if (!resp.ok) {
      return emptyIndustryChannel("eastmoney_quote", `东财行业字段接口异常: ${resp.status}`);
    }
    const json = (await resp.json()) as {
      data?: {
        f127?: string;
      };
    };
    const industryName = json.data?.f127 || undefined;
    return {
      source: "eastmoney_quote",
      available: Boolean(industryName),
      peers: [],
      peerSnapshots: [],
      industryName,
      note: industryName ? "行业字段来自东财 quote 接口" : "东财未返回行业字段",
    };
  } catch (error) {
    return emptyIndustryChannel("eastmoney_quote", `东财行业字段抓取失败: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

function normalizeIndustryKeyword(industryName?: string): string {
  const raw = String(industryName || "").trim();
  if (!raw) return "";
  return raw.replace(/Ⅰ|Ⅱ|Ⅲ|IV|V/gi, "").replace(/\s+/g, "");
}

async function fetchCnIndustryPulse(industryName?: string) {
  const keyword = normalizeIndustryKeyword(industryName);
  if (!keyword) return null;
  try {
    const url =
      "https://17.push2.eastmoney.com/api/qt/clist/get" +
      "?pn=1&pz=500&po=1&np=1&fltt=2&invt=2&fid=f3" +
      "&fs=m:90+t:2+f:!50&fields=f12,f14,f3,f62,f184,f104,f105";
    const resp = await fetchWithTimeout(url, 25000);
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      data?: {
        diff?: Array<{
          f12?: string;
          f14?: string;
          f3?: number;
          f62?: number;
          f104?: number;
          f105?: number;
        }>;
      };
    };
    const diff = json.data?.diff || [];
    if (diff.length === 0) return null;

    const scored = diff
      .map((row) => {
        const boardName = String(row.f14 || "");
        const normalized = normalizeIndustryKeyword(boardName);
        const exact = normalized === keyword ? 100 : 0;
        const include = normalized.includes(keyword) || keyword.includes(normalized) ? 10 : 0;
        return {
          score: exact + include,
          row,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    const picked = scored[0]?.row;
    if (!picked) return null;
    return {
      source: "eastmoney_industry_board",
      boardCode: picked.f12 || undefined,
      boardName: picked.f14 || undefined,
      changePct: asNullableNumber(picked.f3),
      mainNetInflow: asNullableNumber(picked.f62),
      leadingCount: asNullableNumber(picked.f104),
      fallingCount: asNullableNumber(picked.f105),
      asOf: new Date().toISOString(),
      note: "行业板块温度来自东财行业板块行情接口",
    };
  } catch {
    return null;
  }
}

async function fetchYahooIndustryNews(industryName?: string, market?: SupportedMarket) {
  const keyword = String(industryName || "").trim();
  if (!keyword) {
    return {
      source: "yahoo_industry_search",
      available: false,
      count: 0,
      items: [],
      note: "行业名称缺失，无法抓取行业新闻",
    };
  }
  const query = market === "US" ? `${keyword} industry` : `${keyword} 行业`;
  try {
    const url =
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}` +
      "&quotesCount=0&newsCount=12&enableFuzzyQuery=true";
    const resp = await fetchWithTimeout(url, 20000);
    if (!resp.ok) {
      return {
        source: "yahoo_industry_search",
        available: false,
        count: 0,
        items: [],
        note: `行业新闻接口异常: ${resp.status}`,
      };
    }
    const json = (await resp.json()) as {
      news?: Array<{
        providerPublishTime?: number;
        title?: string;
        summary?: string;
        link?: string;
        publisher?: string;
      }>;
    };
    const items =
      (json.news || [])
        .slice(0, 9)
        .map((item) => ({
          date: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString().slice(0, 10) : "",
          headline: item.title || "",
          summary: item.summary || "",
          url: item.link || "",
          source: item.publisher || "Yahoo",
        }))
        .filter((item) => item.headline) || [];
    return {
      source: "yahoo_industry_search",
      available: items.length > 0,
      count: items.length,
      items,
      note: items.length > 0 ? "行业新闻来自 Yahoo Search 关键词检索" : "行业新闻未返回有效结果",
    };
  } catch (error) {
    return {
      source: "yahoo_industry_search",
      available: false,
      count: 0,
      items: [],
      note: `行业新闻抓取失败: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

async function fetchFinnhubSupplementary(symbol: string, market: SupportedMarket): Promise<SupplementaryDataSnapshot> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return {
      prices: {
        source: "yahoo_chart",
        available: false,
        latest: null,
        note: "未配置 FINNHUB_API_KEY，新闻/公告/行业比较数据源不可用",
      },
      news: { source: "finnhub", available: false, count: 0, items: [], note: "缺少 FINNHUB_API_KEY" },
      announcements: { source: "finnhub", available: false, count: 0, items: [], note: "缺少 FINNHUB_API_KEY" },
      industry: { source: "finnhub", available: false, peers: [], peerSnapshots: [], note: "缺少 FINNHUB_API_KEY" },
      sourceTrace: [],
      compliance: {
        strictNoEstimate: true,
        policy: "若数据源缺失，必须显式写明“数据缺失，禁止估算”。",
      },
    };
  }

  const finnhubSymbol = toFinnhubSymbol(symbol, market);
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  const getJson = async <T>(url: string, timeout = 20000): Promise<T | null> => {
    try {
      const resp = await fetchWithTimeout(url, timeout);
      if (!resp.ok) return null;
      return (await resp.json()) as T;
    } catch {
      return null;
    }
  };

  const [profile, peers, news, filings] = await Promise.all([
    getJson<{ finnhubIndustry?: string; name?: string }>(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(finnhubSymbol)}&token=${key}`,
    ),
    getJson<string[]>(
      `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(finnhubSymbol)}&token=${key}`,
    ),
    getJson<
      Array<{ datetime?: number; headline?: string; summary?: string; url?: string }>
    >(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(finnhubSymbol)}&from=${from}&to=${to}&token=${key}`,
    ),
    getJson<
      Array<{ filedDate?: string; form?: string; reportUrl?: string }>
    >(
      `https://finnhub.io/api/v1/stock/filings?symbol=${encodeURIComponent(finnhubSymbol)}&token=${key}`,
    ),
  ]);

  const newsItems =
    (news || [])
      .slice(0, 12)
      .map((item) => ({
        date: item.datetime ? new Date(item.datetime * 1000).toISOString().slice(0, 10) : "",
        headline: item.headline || "",
        summary: item.summary || "",
        url: item.url || "",
        source: "finnhub",
      }))
      .filter((item) => item.headline) || [];

  const filingItems =
    (filings || [])
      .slice(0, 10)
      .map((item) => ({
        date: item.filedDate || "",
        title: item.form ? `Form ${item.form}` : "公司公告",
        url: item.reportUrl || "",
        source: "finnhub",
      }))
      .filter((item) => item.title) || [];

  return {
    prices: {
      source: "yahoo_chart",
      available: false,
      latest: null,
      note: "价格由 Yahoo Chart 补充，Finnhub 仅提供新闻/公告/行业信息。",
    },
    news: {
      source: "finnhub_company_news",
      available: newsItems.length > 0,
      count: newsItems.length,
      items: newsItems,
      note: newsItems.length ? "最近14天公司新闻" : "未获取到新闻",
    },
    announcements: {
      source: "finnhub_stock_filings",
      available: filingItems.length > 0,
      count: filingItems.length,
      items: filingItems,
      note: filingItems.length ? "最近公告/申报列表" : "未获取到公告",
    },
    industry: {
      source: "finnhub_profile_peers",
      available: Boolean(profile?.finnhubIndustry || (peers || []).length > 0),
      peers: (peers || []).slice(0, 8),
      industryName: profile?.finnhubIndustry || undefined,
      peerSnapshots: [],
      note: "行业与可比公司来自 Finnhub",
    },
    sourceTrace: [],
    compliance: {
      strictNoEstimate: true,
      policy: "若数据源缺失，必须显式写明“数据缺失，禁止估算”。",
    },
  };
}

async function fetchSupplementaryData(
  symbol: string,
  market: SupportedMarket,
  yahooSymbol: string,
): Promise<SupplementaryDataSnapshot> {
  // 数据源融合策略：
  // - FinRobot 常用链路：Yahoo + Finnhub + SEC
  // - daily_stock_analysis 常用链路：AkShare(东财/新浪) + Tushare + Longbridge + Yahoo
  const [priceYahoo, priceSina, priceEastmoney, priceTushare, priceLongbridge, finnhub, yahooSearch] = await Promise.all([
    fetchYahooPriceSnapshot(yahooSymbol),
    fetchSinaRealtimePriceSnapshot(symbol, market),
    fetchEastmoneyPriceSnapshot(symbol, market),
    fetchTusharePriceSnapshot(symbol, market),
    fetchLongbridgePriceSnapshot(symbol, market),
    fetchFinnhubSupplementary(symbol, market),
    fetchYahooSearchSupplementary(symbol, yahooSymbol),
  ]);

  const secAnnouncements = market === "US" ? await fetchUsSecAnnouncements(symbol) : null;
  const cnAnnouncements = market === "CN" ? await fetchCnEastmoneyAnnouncements(symbol) : null;
  const cnIndustry = market === "CN" ? await fetchCnEastmoneyIndustry(symbol) : null;

  const finalNews =
    finnhub.news.available
      ? finnhub.news
      : yahooSearch.news.available
        ? yahooSearch.news
        : emptyNewsChannel("none", "新闻数据缺失，禁止估算");

  const priceCandidates: Array<PriceSnapshot> = [
    priceYahoo,
    priceSina,
    priceEastmoney,
    priceTushare,
    priceLongbridge,
  ];
  const finalPrice =
    priceCandidates.find((item) => item.available && (item.latest || 0) > 0) ||
    ({
      source: "none",
      available: false,
      latest: null,
      note: "价格数据多源查询均失败，禁止估算",
    } as PriceSnapshot);

  const finalAnnouncements =
    market === "US"
      ? secAnnouncements && secAnnouncements.available
        ? secAnnouncements
        : finnhub.announcements.available
          ? finnhub.announcements
          : emptyAnnouncementChannel("none", "公告数据缺失，禁止估算")
      : market === "CN"
        ? cnAnnouncements && cnAnnouncements.available
          ? cnAnnouncements
          : finnhub.announcements.available
            ? finnhub.announcements
            : emptyAnnouncementChannel("none", "公告数据缺失，禁止估算")
        : market === "HK"
          ? finnhub.announcements.available
            ? finnhub.announcements
            : emptyAnnouncementChannel("none", "公告数据缺失，禁止估算")
        : finnhub.announcements.available
          ? finnhub.announcements
          : emptyAnnouncementChannel("none", "公告数据缺失，禁止估算");

  const finalIndustry =
    finnhub.industry.available
      ? finnhub.industry
      : cnIndustry && cnIndustry.available
        ? cnIndustry
        : yahooSearch.industry.available
          ? yahooSearch.industry
          : emptyIndustryChannel("none", "行业比较数据缺失，禁止估算");

  const [industryPulse, industryNews] = await Promise.all([
    market === "CN"
      ? fetchCnIndustryPulse(finalIndustry.industryName)
      : Promise.resolve(null),
    fetchYahooIndustryNews(finalIndustry.industryName, market),
  ]);

  const mergedIndustry: SupplementaryDataSnapshot["industry"] = {
    ...finalIndustry,
    industryPulse:
      industryPulse ||
      finalIndustry.industryPulse ||
      ({
        source: market === "CN" ? "eastmoney_industry_board" : "none",
        note: "行业板块温度数据缺失，禁止估算",
      } as NonNullable<SupplementaryDataSnapshot["industry"]["industryPulse"]>),
    industryNews:
      industryNews ||
      finalIndustry.industryNews ||
      ({
        source: "yahoo_industry_search",
        available: false,
        count: 0,
        items: [],
        note: "行业新闻数据缺失，禁止估算",
      } as NonNullable<SupplementaryDataSnapshot["industry"]["industryNews"]>),
  };

  const sourceTrace: SupplementaryDataSnapshot["sourceTrace"] = [
    {
      channel: "prices",
      provider: finalPrice.source,
      status: finalPrice.available ? "ok" : "error",
      note:
        [
          finalPrice.note || "",
          `尝试链路=${priceCandidates.map((item) => `${item.source}:${item.available ? "ok" : "miss"}`).join(" -> ")}`,
        ]
          .filter(Boolean)
          .join(" | "),
    },
    {
      channel: "news",
      provider: finalNews.source,
      status: finalNews.available ? "ok" : "missing",
      note: finalNews.note || "",
    },
    {
      channel: "announcements",
      provider: finalAnnouncements.source,
      status: finalAnnouncements.available ? "ok" : "missing",
      note: finalAnnouncements.note || "",
    },
    {
      channel: "industry",
      provider: mergedIndustry.source,
      status: mergedIndustry.available ? "ok" : "missing",
      note:
        [
          mergedIndustry.note || "",
          mergedIndustry.industryPulse?.note || "",
          mergedIndustry.industryNews?.note || "",
        ]
          .filter(Boolean)
          .join(" | "),
    },
  ];

  return {
    prices: finalPrice,
    news: finalNews,
    announcements: finalAnnouncements,
    industry: mergedIndustry,
    sourceTrace,
    compliance: {
      strictNoEstimate: true,
      policy: "任何新闻/公告/行业比较/宏观字段缺失时，必须显式标注“数据缺失，禁止估算”。",
    },
  };
}

async function fetchYahooLatestBySymbol(symbol: string): Promise<{ value: number | null; asOfDate: string | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const resp = await fetchWithTimeout(url, 20000);
    if (!resp.ok) return { value: null, asOfDate: null };
    const json = (await resp.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };
    const result = json.chart?.result?.[0];
    const ts = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    let latest: number | null = null;
    let latestTs: number | null = null;
    for (let i = closes.length - 1; i >= 0; i -= 1) {
      const close = closes[i];
      if (typeof close === "number" && Number.isFinite(close)) {
        latest = close;
        latestTs = ts[i] || null;
        break;
      }
    }
    return {
      value: latest,
      asOfDate: latestTs ? new Date(latestTs * 1000).toISOString().slice(0, 10) : null,
    };
  } catch {
    return { value: null, asOfDate: null };
  }
}

async function fetchCrossAssetMacroIndicators(
  market: SupportedMarket,
): Promise<Array<{ id: string; name: string; value: number | null; unit?: string; asOfDate?: string | null }>> {
  const defs = [
    { id: "US10Y", ticker: "^TNX", name: "10Y美债收益率", unit: "%" },
    { id: "VIX", ticker: "^VIX", name: "VIX波动率", unit: "" },
    { id: "DXY", ticker: "DX-Y.NYB", name: "美元指数DXY", unit: "" },
    { id: "USDCNH", ticker: "USDCNH=X", name: "USD/CNH", unit: "" },
    { id: "GOLD", ticker: "GC=F", name: "黄金主力", unit: "USD" },
    { id: "BRENT", ticker: "BZ=F", name: "布伦特原油", unit: "USD" },
    { id: "COPPER", ticker: "HG=F", name: "COMEX铜", unit: "USD" },
  ] as const;
  const values = await Promise.all(
    defs.map(async (def) => {
      const latest = await fetchYahooLatestBySymbol(def.ticker);
      return {
        id: `${market}_${def.id}`,
        name: def.name,
        value: latest.value,
        unit: def.unit,
        asOfDate: latest.asOfDate,
      };
    }),
  );
  return values.filter((item) => item.value !== null);
}

async function fetchCnCoreIndexIndicators() {
  const defs = [
    { code: "sh000001", id: "CN_SHCOMP", name: "上证指数" },
    { code: "sz399001", id: "CN_SZCOMP", name: "深证成指" },
    { code: "sh000300", id: "CN_CSI300", name: "沪深300" },
  ] as const;
  const items = await Promise.all(
    defs.map(async (def) => {
      try {
        const url = `https://hq.sinajs.cn/list=${def.code}`;
        const resp = await fetchWithTimeout(url, 20000, {
          headers: { Referer: "https://finance.sina.com.cn" },
        });
        if (!resp.ok) return null;
        const text = await resp.text();
        const first = text.indexOf("\"");
        const last = text.lastIndexOf("\"");
        if (first < 0 || last <= first) return null;
        const payload = text.slice(first + 1, last);
        const parts = payload.split(",");
        const latest = asNullableNumber(parts[3]);
        const date = parts[30] || "";
        if (latest === null) return null;
        return {
          id: def.id,
          name: def.name,
          value: latest,
          unit: "",
          asOfDate: date ? String(date).slice(0, 10) : null,
        };
      } catch {
        return null;
      }
    }),
  );
  return items.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function fetchUsMacroSnapshot(): Promise<MacroSnapshot> {
  const parseFredLatest = async (seriesId: string): Promise<{ value: number | null; asOfDate: string | null }> => {
    try {
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
      const response = await fetchWithTimeout(url, 30000);
      if (!response.ok) return { value: null, asOfDate: null };
      const text = await response.text();
      const lines = text.trim().split("\n");
      for (let i = lines.length - 1; i >= 1; i--) {
        const line = lines[i];
        const parts = line.split(",");
        if (parts.length < 2) continue;
        const value = Number(parts[1]);
        if (Number.isFinite(value)) {
          return { value, asOfDate: parts[0] || null };
        }
      }
      return { value: null, asOfDate: null };
    } catch {
      return { value: null, asOfDate: null };
    }
  };

  const defs: Array<{ id: string; name: string; unit: string }> = [
    { id: "M1SL", name: "M1 货币供应", unit: "Billions USD" },
    { id: "M2SL", name: "M2 货币供应", unit: "Billions USD" },
    { id: "CPIAUCSL", name: "CPI 指数", unit: "Index" },
    { id: "UNRATE", name: "失业率", unit: "%" },
    { id: "FEDFUNDS", name: "联邦基金利率", unit: "%" },
    { id: "DGS10", name: "10年期美债收益率", unit: "%" },
    { id: "GDPC1", name: "实际GDP", unit: "Billions USD" },
    { id: "PAYEMS", name: "非农就业人数", unit: "Thousands" },
    { id: "INDPRO", name: "工业生产指数", unit: "Index" },
    { id: "PCEPI", name: "PCE 物价指数", unit: "Index" },
    { id: "RSAFS", name: "零售销售额", unit: "Millions USD" },
  ];

  const indicatorValues = await Promise.all(
    defs.map(async (def) => {
      const latest = await parseFredLatest(def.id);
      return {
        id: def.id,
        name: def.name,
        unit: def.unit,
        value: latest.value,
        asOfDate: latest.asOfDate,
      };
    }),
  );

  const crossAsset = await fetchCrossAssetMacroIndicators("US");
  const allIndicators = [...indicatorValues, ...crossAsset];
  const m1 = allIndicators.find((x) => x.id === "M1SL")?.value ?? null;
  const m2 = allIndicators.find((x) => x.id === "M2SL")?.value ?? null;
  const available = allIndicators.some((x) => x.value !== null);
  return {
    source: "FRED",
    available,
    note: available
      ? "已接入 FRED 宏观主指标 + Yahoo 跨资产宏观雷达"
      : "FRED 宏观数据暂不可用，严禁推断具体数值",
    m1_latest: m1,
    m2_latest: m2,
    indicators: allIndicators,
    updated_at: new Date().toISOString(),
  };
}

async function fetchEastmoneyMacroReportLatest(
  reportName: string,
): Promise<Record<string, unknown> | null> {
  try {
    const url =
      `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${encodeURIComponent(reportName)}` +
      `&columns=ALL&sortColumns=REPORT_DATE&sortTypes=-1&pageNumber=1&pageSize=1`;
    const resp = await fetchWithTimeout(url, 25000);
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      success?: boolean;
      result?: { data?: Array<Record<string, unknown>> };
    };
    if (!json.success) return null;
    return json.result?.data?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchCnMacroSnapshot(): Promise<MacroSnapshot> {
  // A股宏观主链路：东财宏观数据中心（AkShare 常用同源）
  const [money, cpi, ppi, pmi, gdp] = await Promise.all([
    fetchEastmoneyMacroReportLatest("RPT_ECONOMY_CURRENCY_SUPPLY"),
    fetchEastmoneyMacroReportLatest("RPT_ECONOMY_CPI"),
    fetchEastmoneyMacroReportLatest("RPT_ECONOMY_PPI"),
    fetchEastmoneyMacroReportLatest("RPT_ECONOMY_PMI"),
    fetchEastmoneyMacroReportLatest("RPT_ECONOMY_GDP"),
  ]);

  const indicators: Array<{ id: string; name: string; value: number | null; unit?: string; asOfDate?: string | null }> = [
    {
      id: "CN_M1",
      name: "M1 同比",
      value: money ? asNullableNumber(money.BASIC_CURRENCY_SAME) : null,
      unit: "%",
      asOfDate: money?.REPORT_DATE ? String(money.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_M2",
      name: "M2 同比",
      value: money ? asNullableNumber(money.CURRENCY_SAME) : null,
      unit: "%",
      asOfDate: money?.REPORT_DATE ? String(money.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_M0_YOY",
      name: "M0 同比",
      value: money ? asNullableNumber(money.FREE_CASH_SAME) : null,
      unit: "%",
      asOfDate: money?.REPORT_DATE ? String(money.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_M1_LEVEL",
      name: "M1 余额",
      value: money ? asNullableNumber(money.BASIC_CURRENCY) : null,
      unit: "亿元",
      asOfDate: money?.REPORT_DATE ? String(money.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_M2_LEVEL",
      name: "M2 余额",
      value: money ? asNullableNumber(money.CURRENCY) : null,
      unit: "亿元",
      asOfDate: money?.REPORT_DATE ? String(money.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_CPI_YOY",
      name: "CPI 同比",
      value: cpi ? asNullableNumber(cpi.NATIONAL_SAME) : null,
      unit: "%",
      asOfDate: cpi?.REPORT_DATE ? String(cpi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_CPI_MOM",
      name: "CPI 环比",
      value: cpi ? asNullableNumber(cpi.NATIONAL_SEQUENTIAL) : null,
      unit: "%",
      asOfDate: cpi?.REPORT_DATE ? String(cpi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_CPI_ACC",
      name: "CPI 累计",
      value: cpi ? asNullableNumber(cpi.NATIONAL_ACCUMULATE) : null,
      unit: "",
      asOfDate: cpi?.REPORT_DATE ? String(cpi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_PPI_YOY",
      name: "PPI 同比",
      value: ppi ? asNullableNumber(ppi.BASE_SAME) : null,
      unit: "%",
      asOfDate: ppi?.REPORT_DATE ? String(ppi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_PPI_ACC",
      name: "PPI 累计",
      value: ppi ? asNullableNumber(ppi.BASE_ACCUMULATE) : null,
      unit: "",
      asOfDate: ppi?.REPORT_DATE ? String(ppi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_MANUFACTURING_PMI",
      name: "制造业 PMI",
      value: pmi ? asNullableNumber(pmi.MAKE_INDEX) : null,
      unit: "",
      asOfDate: pmi?.REPORT_DATE ? String(pmi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_NON_MANUFACTURING_PMI",
      name: "非制造业 PMI",
      value: pmi ? asNullableNumber(pmi.NMAKE_INDEX) : null,
      unit: "",
      asOfDate: pmi?.REPORT_DATE ? String(pmi.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_GDP_YOY",
      name: "GDP 同比",
      value: gdp ? asNullableNumber(gdp.SUM_SAME) : null,
      unit: "%",
      asOfDate: gdp?.REPORT_DATE ? String(gdp.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_GDP_LEVEL",
      name: "GDP 总量",
      value: gdp ? asNullableNumber(gdp.DOMESTICL_PRODUCT_BASE) : null,
      unit: "亿元",
      asOfDate: gdp?.REPORT_DATE ? String(gdp.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_GDP_PRIMARY_YOY",
      name: "第一产业同比",
      value: gdp ? asNullableNumber(gdp.FIRST_SAME) : null,
      unit: "%",
      asOfDate: gdp?.REPORT_DATE ? String(gdp.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_GDP_SECONDARY_YOY",
      name: "第二产业同比",
      value: gdp ? asNullableNumber(gdp.SECOND_SAME) : null,
      unit: "%",
      asOfDate: gdp?.REPORT_DATE ? String(gdp.REPORT_DATE).slice(0, 10) : null,
    },
    {
      id: "CN_GDP_TERTIARY_YOY",
      name: "第三产业同比",
      value: gdp ? asNullableNumber(gdp.THIRD_SAME) : null,
      unit: "%",
      asOfDate: gdp?.REPORT_DATE ? String(gdp.REPORT_DATE).slice(0, 10) : null,
    },
  ];
  const [crossAsset, cnIndex] = await Promise.all([fetchCrossAssetMacroIndicators("CN"), fetchCnCoreIndexIndicators()]);
  const allIndicators = [...indicators, ...crossAsset, ...cnIndex];
  const available = allIndicators.some((item) => item.value !== null && Number.isFinite(item.value));
  const m1 = allIndicators.find((x) => x.id === "CN_M1")?.value ?? null;
  const m2 = allIndicators.find((x) => x.id === "CN_M2")?.value ?? null;
  return {
    source: "Eastmoney Macro Center",
    available,
    note: available
      ? "A股宏观已接入：东财官方统计 + 跨资产宏观雷达 + A股核心指数"
      : "A股宏观多项指标均缺失，禁止估算",
    m1_latest: m1,
    m2_latest: m2,
    indicators: allIndicators,
    updated_at: new Date().toISOString(),
  };
}

async function fetchMacroSnapshot(market: SupportedMarket): Promise<MacroSnapshot> {
  if (market === "US") {
    return fetchUsMacroSnapshot();
  }
  if (market === "CN") {
    return fetchCnMacroSnapshot();
  }
  if (market === "HK") {
    const [usMacro, cnMacro] = await Promise.all([fetchUsMacroSnapshot(), fetchCnMacroSnapshot()]);
    const indicators = [...(usMacro.indicators || []), ...(cnMacro.indicators || [])];
    const available = indicators.some((x) => x.value !== null);
    return {
      source: "HK proxy macro (US FRED + CN Eastmoney)",
      available,
      note: available
        ? "港股宏观采用双锚：美联储/FRED + 中国宏观（东财）"
        : "港股宏观代理指标暂缺，禁止估算",
      m1_latest: cnMacro.m1_latest ?? null,
      m2_latest: cnMacro.m2_latest ?? null,
      indicators,
      updated_at: new Date().toISOString(),
    };
  }
  return {
    source: "none",
    available: false,
    note: "当前未接入该市场的实时官方宏观源（M1/M2/CPI/失业率等），分析中必须显式写“数据缺失，禁止估算”。",
    m1_latest: null,
    m2_latest: null,
    indicators: [
      { id: "M1", name: "M1 货币供应", value: null, unit: "", asOfDate: null },
      { id: "M2", name: "M2 货币供应", value: null, unit: "", asOfDate: null },
      { id: "CPI", name: "CPI 指数", value: null, unit: "", asOfDate: null },
      { id: "UNEMPLOYMENT", name: "失业率", value: null, unit: "", asOfDate: null },
      { id: "POLICY_RATE", name: "政策利率", value: null, unit: "", asOfDate: null },
      { id: "BOND_10Y", name: "10年期国债收益率", value: null, unit: "", asOfDate: null },
    ],
    updated_at: null,
  };
}

async function loadSnapshotFromCache(symbol: string, market: SupportedMarket): Promise<FinancialSnapshotPack | null> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("stock_financial_snapshots")
    .select("payload,expires_at")
    .eq("stock_code", symbol)
    .eq("market", market)
    .maybeSingle();
  if (error || !data?.payload) return null;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt <= Date.now()) return null;
  return data.payload as FinancialSnapshotPack;
}

async function saveSnapshotCache(symbol: string, market: SupportedMarket, payload: FinancialSnapshotPack): Promise<void> {
  const supabase = getSupabaseAdmin() as any;
  const expiresAt = new Date(Date.now() + SNAPSHOT_TTL_MINUTES * 60 * 1000).toISOString();
  await supabase.from("stock_financial_snapshots").upsert(
    {
      stock_code: symbol,
      market,
      payload,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "market,stock_code" },
  );
}

function toStatementRows(rows: YearRow[], keys: Array<keyof YearRow>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const next: Record<string, unknown> = { fiscal_year: row.fiscal_year };
    for (const key of keys) {
      next[key] = row[key];
    }
    return next;
  });
}

export async function loadRealtimeFinancialSnapshot(params: {
  symbol: string;
  market: SupportedMarket;
  disableCache?: boolean;
}): Promise<FinancialSnapshotPack> {
  const symbol = params.symbol.toUpperCase();
  if (!params.disableCache) {
    const cached = await loadSnapshotFromCache(symbol, params.market);
    if (cached) return cached;
  }

  const yahooSymbol = toYahooSymbol(symbol, params.market);
  const [macro, supplementary] = await Promise.all([
    fetchMacroSnapshot(params.market),
    fetchSupplementaryData(symbol, params.market, yahooSymbol),
  ]);
  const ts = await fetchFinancialRowsWithFallback(symbol, params.market, yahooSymbol);
  if (ts.rows.length === 0) {
    throw new Error(`未获取到可用财务数据：${symbol} (${yahooSymbol})`);
  }

  const windowRows = selectWindow(ts.rows);
  const fraudSignals = buildFraudSignals(windowRows);
  const years = windowRows.length >= 10 ? 10 : windowRows.length >= 5 ? 5 : Math.min(3, windowRows.length);
  const fallbackNotice =
    years >= 10 ? "使用10年数据窗口" : years >= 5 ? "10年不足，降级为5年窗口" : "10/5年不足，降级为3年窗口";

  const pack: FinancialSnapshotPack = {
    symbol,
    market: params.market,
    yahooSymbol,
    years,
    rows: windowRows.map((r) => ({ ...r })),
    statements: {
      income_statement: toStatementRows(windowRows, [
        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "diluted_eps",
        "net_margin",
      ]),
      balance_sheet: toStatementRows(windowRows, [
        "total_assets",
        "stockholders_equity",
        "total_debt",
        "current_assets",
        "current_liabilities",
        "accounts_receivable",
        "inventory",
        "retained_earnings",
        "equity_multiplier",
      ]),
      cash_flow: toStatementRows(windowRows, [
        "operating_cash_flow",
        "capex",
        "free_cash_flow",
        "market_cap",
        "roic",
        "wacc",
        "roe",
        "asset_turnover",
      ]),
    },
    fraudSignals,
    macro,
    supplementary,
    dataQuality: {
      source: ts.source,
      missingMetrics: ts.missingMetrics,
      fiscalYearCount: windowRows.length,
      fallbackNotice: `${fallbackNotice}; chain=${ts.attempts
        .map((item) => `${item.provider}:${item.available ? "ok" : "miss"}`)
        .join(" -> ")}`,
      lastRefreshAt: new Date().toISOString(),
    },
  };

  await saveSnapshotCache(symbol, params.market, pack);
  return pack;
}

export async function loadFinancialWindow(ticker: string, market: SupportedMarket = "US"): Promise<FinancialWindow> {
  const pack = await loadRealtimeFinancialSnapshot({ symbol: ticker, market });
  return {
    years: pack.years,
    rows: pack.rows,
  };
}

export function buildDeepDiveSignals(rows: Array<Record<string, unknown>>) {
  const mapped = rows
    .map((row) => ({
      fiscal_year: Number(row.fiscal_year),
      revenue: asNumber(row.revenue),
      net_income: asNumber(row.net_income),
      operating_cash_flow: asNumber(row.operating_cash_flow),
      capex: asNumber(row.capex),
      free_cash_flow: asNumber(row.free_cash_flow),
      net_margin: asNumber(row.net_margin),
      asset_turnover: asNumber(row.asset_turnover),
      equity_multiplier: asNumber(row.equity_multiplier),
      roe: asNumber(row.roe),
      roic: asNumber(row.roic),
      wacc: asNumber(row.wacc),
      market_cap: asNumber(row.market_cap),
      retained_earnings: asNumber(row.retained_earnings),
    }))
    .filter((row) => Number.isFinite(row.fiscal_year) && row.fiscal_year > 1900)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
  return computeDeepDiveSignals(mapped as unknown as YearRow[]);
}
