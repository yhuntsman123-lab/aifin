"use client";

import { useMemo, useState } from "react";

type StatementKey = "income_statement" | "balance_sheet" | "cash_flow";

interface Props {
  statements?: {
    income_statement?: Array<Record<string, unknown>>;
    balance_sheet?: Array<Record<string, unknown>>;
    cash_flow?: Array<Record<string, unknown>>;
  };
}

const TITLES: Record<StatementKey, string> = {
  income_statement: "利润表",
  balance_sheet: "资产负债表",
  cash_flow: "现金流量表",
};

const STATEMENT_HINTS: Record<StatementKey, string> = {
  income_statement: "看增长与盈利质量：收入、毛利、净利、净利率。",
  balance_sheet: "看资产质量与杠杆：资产、负债、权益、应收、存货。",
  cash_flow: "看现金兑现能力：经营现金流、资本开支、自由现金流。",
};

const METRIC_LABELS: Record<string, string> = {
  revenue: "营业收入",
  gross_profit: "毛利润",
  operating_income: "营业利润",
  net_income: "净利润",
  diluted_eps: "摊薄每股收益",
  net_margin: "净利率",
  total_assets: "总资产",
  stockholders_equity: "股东权益",
  total_debt: "总负债",
  current_assets: "流动资产",
  current_liabilities: "流动负债",
  accounts_receivable: "应收账款",
  inventory: "存货",
  retained_earnings: "留存收益",
  equity_multiplier: "权益乘数",
  operating_cash_flow: "经营现金流",
  capex: "资本开支",
  free_cash_flow: "自由现金流",
  market_cap: "市值",
  roic: "ROIC",
  wacc: "WACC",
  roe: "ROE",
  asset_turnover: "资产周转率",
};

function toNumber(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatValue(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

function metricLabel(metric: string): string {
  const mapped = METRIC_LABELS[metric];
  if (mapped) return mapped;
  return metric.replace(/_/g, " ").toUpperCase();
}

function Sparkline(props: { values: number[] }) {
  const values = props.values.filter((v) => Number.isFinite(v));
  if (values.length === 0) return <div className="h-16 text-xs text-slate-500">无可视化数据</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-full rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={points} className="text-blue-600 dark:text-blue-300" />
      {values.map((value, idx) => {
        const x = (idx / Math.max(values.length - 1, 1)) * 100;
        const y = 100 - ((value - min) / span) * 100;
        return <circle key={`${idx}-${value}`} cx={x} cy={y} r="1.6" className="fill-blue-700 dark:fill-blue-200" />;
      })}
    </svg>
  );
}

export default function FinancialStatementsPanel({ statements }: Props) {
  const [tab, setTab] = useState<StatementKey>("income_statement");
  const rows = useMemo(() => (statements?.[tab] || []) as Array<Record<string, unknown>>, [statements, tab]);
  const metrics = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).filter((k) => k !== "fiscal_year");
  }, [rows]);
  const [metric, setMetric] = useState<string>("");

  const activeMetric = metric || metrics[0] || "";
  const chartValues = rows.map((r) => toNumber(r[activeMetric]));

  const normalizedRows = rows.map((row) => {
    const year = Number(row.fiscal_year || 0);
    const value = toNumber(row[activeMetric]);
    return {
      fiscalYear: year || 0,
      value,
    };
  });

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">三张表动态可视化</h3>
        <div className="flex gap-2 text-sm">
          {(Object.keys(TITLES) as StatementKey[]).map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => {
                setTab(key);
                setMetric("");
              }}
              className={`rounded-md border px-3 py-1 ${
                tab === key
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              {TITLES[key]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">{STATEMENT_HINTS[tab]}</p>

      {rows.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          当前报告未提供该表数据。
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">细项：</label>
            <select
              value={activeMetric}
              onChange={(event) => setMetric(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              {metrics.map((item) => (
                <option key={item} value={item}>
                  {metricLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">趋势图（按年份）：{metricLabel(activeMetric)}</p>
            <Sparkline values={chartValues} />
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70">
                <tr>
                  <th className="px-3 py-2 text-left">年份</th>
                  <th className="px-3 py-2 text-left">指标</th>
                  <th className="px-3 py-2 text-left">数值</th>
                  <th className="px-3 py-2 text-left">同比</th>
                </tr>
              </thead>
              <tbody>
                {normalizedRows.map((row, idx) => {
                  const prev = idx > 0 ? normalizedRows[idx - 1].value : null;
                  const yoy = prev && prev !== 0 ? (row.value - prev) / Math.abs(prev) : null;
                  return (
                    <tr key={`${row.fiscalYear}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{row.fiscalYear || "--"}</td>
                      <td className="px-3 py-2">{metricLabel(activeMetric)}</td>
                      <td className="px-3 py-2">{formatValue(row.value)}</td>
                      <td
                        className={`px-3 py-2 ${
                          yoy === null ? "" : yoy >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {yoy === null ? "--" : `${(yoy * 100).toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
