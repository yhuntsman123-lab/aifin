export type SectionAgentKey =
  | "alpha_hook"
  | "fundamental_macro"
  | "quant_pricing"
  | "industry_comparison"
  | "news_altdata"
  | "risk_management"
  | "execution_strategy";

export type AgentKey = SectionAgentKey | "chief_editor";

export interface PromptTemplate {
  agentKey: AgentKey;
  displayName: string;
  systemPrompt: string;
}

export interface AgentInputContext {
  stockCode: string;
  stockName: string;
  market: "CN" | "HK" | "US";
  lang: "zh-CN";
  financialWindowYears: number;
  financialData: unknown[];
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
  extraSignals?: Record<string, unknown>;
}

export interface SectionResult {
  agentKey: SectionAgentKey;
  title: string;
  content: string;
}
