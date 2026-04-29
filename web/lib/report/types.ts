export type SupportedMarket = "CN" | "HK" | "US";

export interface StockIdentity {
  code: string;
  name: string;
  shortName?: string;
  market: SupportedMarket;
}

export interface ReportSection {
  title: string;
  content: string;
  chartKeys?: string[];
}

export interface ReportChart {
  key: string;
  title: string;
  imageUrl?: string;
  imagePath?: string;
}

export interface InstitutionalReport {
  id: string;
  title: string;
  stock: StockIdentity;
  generatedAt: string;
  lang: "zh-CN" | "en-US";
  htmlUrl?: string;
  sections: ReportSection[];
  charts: ReportChart[];
  disclaimer?: string;
  deepDiveSignals?: {
    yearly?: Array<Record<string, unknown>>;
    cumulative?: Array<Record<string, unknown>>;
    retained_roi_percent?: number | null;
    value_creation_years?: number[];
    value_destruction_years?: number[];
  };
  financialStatements?: {
    income_statement?: Array<Record<string, unknown>>;
    balance_sheet?: Array<Record<string, unknown>>;
    cash_flow?: Array<Record<string, unknown>>;
  };
  fraudSignals?: Array<{
    id: string;
    level: "low" | "medium" | "high";
    title: string;
    detail: string;
    evidence: string[];
  }>;
  macroSnapshot?: {
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
  };
  dataQuality?: {
    source: string;
    missingMetrics: string[];
    fiscalYearCount: number;
    fallbackNotice: string;
    lastRefreshAt: string;
  };
  supplementaryData?: {
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
  };
  evidenceAnchors?: Array<{
    id: string;
    sectionTitle: string;
    claim: string;
    year: string;
    metric: string;
    value: string;
    source: string;
    note?: string;
  }>;
}

export interface DerivativeTaskResult {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  action: "wechat" | "xiaohongshu" | "douyin" | "pdf";
  outputUrl?: string;
  outputText?: string;
  outputJson?: Record<string, unknown>;
  errorMessage?: string;
}
