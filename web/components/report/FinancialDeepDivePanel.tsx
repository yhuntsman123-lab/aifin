"use client";

import { useEffect, useMemo, useState } from "react";

type PanelMode = "dupont" | "roic_wacc" | "cashflow_profit";

interface DeepDiveProps {
  yearly?: Array<Record<string, unknown>>;
  cumulative?: Array<Record<string, unknown>>;
  retainedRoiPercent?: number | null;
}

interface YearlyPoint {
  year: number;
  revenue: number;
  netIncome: number;
  netMargin: number;
  assetTurnover: number;
  equityMultiplier: number;
  roe: number;
  roic: number;
  wacc: number;
  freeCashFlow: number;
}

interface CumulativePoint {
  year: number;
  cumulativeNetIncome: number;
  cumulativeFcf: number;
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function percent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
  return value.toFixed(2);
}

function buildPolyline(values: number[], min: number, max: number): string {
  if (values.length === 0) return "";
  const span = max - min || 1;
  return values
    .map((value, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function StatCard(props: { label: string; value: string; tone?: "blue" | "green" | "amber" | "rose" }) {
  const toneClass =
    props.tone === "green"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
      : props.tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        : props.tone === "rose"
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
          : "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300";
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${toneClass}`}>
      <p className="text-[11px]">{props.label}</p>
      <p className="mt-1 font-semibold">{props.value}</p>
    </div>
  );
}

export default function FinancialDeepDivePanel(props: DeepDiveProps) {
  const yearlyData = useMemo<YearlyPoint[]>(() => {
    return (props.yearly || [])
      .map((item) => ({
        year: Number(item.fiscal_year || 0),
        revenue: toNumber(item.revenue),
        netIncome: toNumber(item.net_income),
        netMargin: toNumber(item.net_margin),
        assetTurnover: toNumber(item.asset_turnover),
        equityMultiplier: toNumber(item.equity_multiplier),
        roe: toNumber(item.roe),
        roic: toNumber(item.roic),
        wacc: toNumber(item.wacc),
        freeCashFlow: toNumber(item.free_cash_flow),
      }))
      .filter((item) => item.year > 1900)
      .sort((a, b) => a.year - b.year);
  }, [props.yearly]);

  const cumulativeData = useMemo<CumulativePoint[]>(() => {
    return (props.cumulative || [])
      .map((item) => ({
        year: Number(item.year || 0),
        cumulativeNetIncome: toNumber(item.cumulative_net_income),
        cumulativeFcf: toNumber(item.cumulative_fcf),
      }))
      .filter((item) => item.year > 1900)
      .sort((a, b) => a.year - b.year);
  }, [props.cumulative]);

  const [mode, setMode] = useState<PanelMode>("dupont");
  const [selectedIndex, setSelectedIndex] = useState(Math.max(yearlyData.length - 1, 0));

  useEffect(() => {
    setSelectedIndex(Math.max(yearlyData.length - 1, 0));
  }, [yearlyData.length]);

  if (yearlyData.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <h3 className="text-base font-semibold">10-Year Financial & Capital Allocation Deep Dive</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">暂无可用历史财务数据，暂不展示动态分析面板。</p>
      </section>
    );
  }

  const selected = yearlyData[selectedIndex] || yearlyData[yearlyData.length - 1];
  const firstYear = yearlyData[0].year;
  const lastYear = yearlyData[yearlyData.length - 1].year;
  const gapPercent = (selected.roic - selected.wacc) * 100;
  const latestCumulative = cumulativeData[cumulativeData.length - 1];
  const cashConversion =
    latestCumulative && latestCumulative.cumulativeNetIncome !== 0
      ? latestCumulative.cumulativeFcf / latestCumulative.cumulativeNetIncome
      : 0;

  const roeSeries = yearlyData.map((item) => item.roe * 100);
  const roicSeries = yearlyData.map((item) => item.roic * 100);
  const waccSeries = yearlyData.map((item) => item.wacc * 100);
  const gapSeries = yearlyData.map((item) => (item.roic - item.wacc) * 100);

  const rateMin = Math.min(...roicSeries, ...waccSeries);
  const rateMax = Math.max(...roicSeries, ...waccSeries);
  const gapAbsMax = Math.max(1, ...gapSeries.map((item) => Math.abs(item)));

  const cumulativeNetSeries = cumulativeData.map((item) => item.cumulativeNetIncome);
  const cumulativeFcfSeries = cumulativeData.map((item) => item.cumulativeFcf);
  const cumulativeMin = Math.min(...cumulativeNetSeries, ...cumulativeFcfSeries, 0);
  const cumulativeMax = Math.max(...cumulativeNetSeries, ...cumulativeFcfSeries, 1);

  const cumulativeBarBase = Math.max(
    1,
    Math.abs(latestCumulative?.cumulativeNetIncome || 0),
    Math.abs(latestCumulative?.cumulativeFcf || 0),
  );
  const cumulativeNetWidth = Math.min(
    100,
    (Math.abs(latestCumulative?.cumulativeNetIncome || 0) / cumulativeBarBase) * 100,
  );
  const cumulativeFcfWidth = Math.min(
    100,
    (Math.abs(latestCumulative?.cumulativeFcf || 0) / cumulativeBarBase) * 100,
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">10-Year Financial & Capital Allocation Deep Dive</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            价值创造（绿区）
          </span>
          <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            价值毁灭（红区）
          </span>
        </div>
      </div>

      <div className="grid gap-2 text-sm md:grid-cols-3">
        <StatCard label="选定年度" value={`${selected.year}`} />
        <StatCard
          label="ROIC-WACC 剪刀差"
          value={`${gapPercent >= 0 ? "+" : ""}${gapPercent.toFixed(2)}pct`}
          tone={gapPercent >= 0 ? "green" : "rose"}
        />
        <StatCard
          label="留存收益ROI"
          value={props.retainedRoiPercent === null || props.retainedRoiPercent === undefined ? "--" : `${props.retainedRoiPercent.toFixed(2)}%`}
          tone={props.retainedRoiPercent && props.retainedRoiPercent > 100 ? "green" : "amber"}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("dupont")}
          className={`rounded-md border px-3 py-1 ${
            mode === "dupont"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          杜邦分析树
        </button>
        <button
          type="button"
          onClick={() => setMode("roic_wacc")}
          className={`rounded-md border px-3 py-1 ${
            mode === "roic_wacc"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          ROIC vs WACC
        </button>
        <button
          type="button"
          onClick={() => setMode("cashflow_profit")}
          className={`rounded-md border px-3 py-1 ${
            mode === "cashflow_profit"
              ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          现金流与利润对比
        </button>
      </div>

      {mode === "dupont" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/35">
          <p className="text-sm font-medium">
            指标含义：ROE = 净利率 × 资产周转率 × 权益乘数。若 ROE 主要靠杠杆上升维持而净利率下滑，应标红“质量降级”。
          </p>
          <div className="relative rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mx-auto mb-3 max-w-[220px]">
              <StatCard label="ROE（净资产收益率）" value={percent(selected.roe)} tone="blue" />
            </div>
            <div className="mx-auto mb-3 h-2 w-px bg-slate-400 dark:bg-slate-500" />
            <div className="mx-auto mb-3 h-px max-w-3xl bg-slate-300 dark:bg-slate-600" />
            <div className="grid gap-3 md:grid-cols-3">
              <StatCard label="净利率" value={percent(selected.netMargin)} tone="blue" />
              <StatCard label="资产周转率" value={selected.assetTurnover.toFixed(2)} tone="green" />
              <StatCard label="权益乘数" value={selected.equityMultiplier.toFixed(2)} tone="amber" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">十年 ROE 轨迹（%）</p>
            <svg viewBox="0 0 100 100" className="h-28 w-full">
              <polyline
                points={buildPolyline(roeSeries, Math.min(...roeSeries, 0), Math.max(...roeSeries, 1))}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.4"
              />
            </svg>
          </div>
        </div>
      )}

      {mode === "roic_wacc" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/35">
          <p className="text-sm font-medium">
            指标含义：ROIC 长期高于 WACC 才代表真实价值创造。若净利润增长但剪刀差长期为负，多为低效扩张信号。
          </p>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className={`text-center text-lg font-semibold ${gapPercent >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
              {gapPercent >= 0 ? "价值创造" : "价值毁灭"}（{gapPercent.toFixed(2)}pct）
            </p>
            <div className="mx-auto mt-3 flex max-w-md items-end justify-center gap-8">
              {[
                { label: "ROIC", value: selected.roic * 100, tone: "bg-emerald-600 dark:bg-emerald-500" },
                { label: "WACC", value: selected.wacc * 100, tone: "bg-rose-600 dark:bg-rose-500" },
              ].map((item) => {
                const height = Math.max(14, (Math.abs(item.value) / Math.max(rateMax, 1)) * 120);
                return (
                  <div key={item.label} className="flex w-24 flex-col items-center gap-2">
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600">
                      {item.label}: {item.value.toFixed(2)}%
                    </span>
                    <div className={`w-14 rounded-t ${item.tone}`} style={{ height }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">十年剪刀差（ROIC-WACC，pct）</p>
            <svg viewBox="0 0 100 70" className="h-24 w-full">
              <line x1="0" y1="35" x2="100" y2="35" stroke="#94a3b8" strokeWidth="0.6" />
              {gapSeries.map((gap, idx) => {
                const barWidth = 100 / Math.max(gapSeries.length, 1) - 1.2;
                const x = (idx / Math.max(gapSeries.length, 1)) * 100 + 0.6;
                const h = (Math.abs(gap) / gapAbsMax) * 30;
                const y = gap >= 0 ? 35 - h : 35;
                return <rect key={`${gap}-${idx}`} x={x} y={y} width={Math.max(barWidth, 0.8)} height={h} fill={gap >= 0 ? "#16a34a" : "#dc2626"} />;
              })}
            </svg>
          </div>
        </div>
      )}

      {mode === "cashflow_profit" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/35">
          <p className="text-sm font-medium">
            指标含义：利润可修饰，现金更真实。重点关注累计净利润与累计 FCF 偏离，偏离大时要警惕商业模式和会计质量风险。
          </p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              最新累计净利润：{formatShort(latestCumulative?.cumulativeNetIncome || 0)} ｜ 最新累计FCF：
              {formatShort(latestCumulative?.cumulativeFcf || 0)} ｜ 现金含金量：{(cashConversion * 100).toFixed(2)}%
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-slate-500">累计净利</span>
                <div className="h-3 rounded bg-blue-500/85" style={{ width: `${cumulativeNetWidth}%` }} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-slate-500">累计FCF</span>
                <div className="h-3 rounded bg-emerald-500/85" style={{ width: `${cumulativeFcfWidth}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">累计净利润 vs 累计FCF 轨迹</p>
            <svg viewBox="0 0 100 100" className="h-28 w-full">
              <polyline
                points={buildPolyline(cumulativeNetSeries, cumulativeMin, cumulativeMax)}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.4"
              />
              <polyline
                points={buildPolyline(cumulativeFcfSeries, cumulativeMin, cumulativeMax)}
                fill="none"
                stroke="#16a34a"
                strokeWidth="2.4"
              />
            </svg>
          </div>
        </div>
      )}

      {yearlyData.length > 1 && (
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            分析年份：{firstYear} - {lastYear}（当前 {selected.year}）
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(yearlyData.length - 1, 0)}
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      )}
    </section>
  );
}

