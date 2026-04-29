interface Props {
  yearly?: Array<Record<string, unknown>>;
  cumulative?: Array<Record<string, unknown>>;
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function buildLinePoints(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function ReportSignalCharts({ yearly = [], cumulative = [] }: Props) {
  const orderedYearly = [...yearly]
    .map((item) => ({
      year: Number(item.fiscal_year || 0),
      roic: toNumber(item.roic) * 100,
      wacc: toNumber(item.wacc) * 100,
    }))
    .filter((item) => item.year > 1900)
    .sort((a, b) => a.year - b.year);

  const orderedCumulative = [...cumulative]
    .map((item) => ({
      year: Number(item.year || 0),
      net: toNumber(item.cumulative_net_income),
      fcf: toNumber(item.cumulative_fcf),
    }))
    .filter((item) => item.year > 1900)
    .sort((a, b) => a.year - b.year);

  if (orderedYearly.length === 0 && orderedCumulative.length === 0) {
    return null;
  }

  const roicSeries = orderedYearly.map((item) => item.roic);
  const waccSeries = orderedYearly.map((item) => item.wacc);
  const allRate = [...roicSeries, ...waccSeries];
  const rateMin = allRate.length ? Math.min(...allRate) : 0;
  const rateMax = allRate.length ? Math.max(...allRate) : 0;
  const roicPoints = buildLinePoints(roicSeries);
  const waccPoints = buildLinePoints(waccSeries);

  const netMax = Math.max(1, ...orderedCumulative.map((item) => Math.abs(item.net)), ...orderedCumulative.map((item) => Math.abs(item.fcf)));

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <header className="mb-3">
          <h3 className="text-sm font-semibold">价值创造轨迹（ROIC vs WACC）</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            ROIC 长期高于 WACC 才意味着资本配置有效。若长期低于 WACC，应降级结论置信度。
          </p>
        </header>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/30">
          <svg viewBox="0 0 100 100" className="h-40 w-full">
            <polyline points={roicPoints} fill="none" stroke="#16a34a" strokeWidth="2.5" />
            <polyline points={waccPoints} fill="none" stroke="#dc2626" strokeDasharray="3 2" strokeWidth="2.2" />
          </svg>
          <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
            区间：{rateMin.toFixed(2)}% ~ {rateMax.toFixed(2)}%，绿色为 ROIC，红色虚线为 WACC。
          </p>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <header className="mb-3">
          <h3 className="text-sm font-semibold">累计利润与累计FCF对比</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            利润可修饰，现金更真实。若累计净利润显著高于累计 FCF，需要警惕质量风险。
          </p>
        </header>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/30">
          {orderedCumulative.map((item) => {
            const netWidth = Math.min(100, (Math.abs(item.net) / netMax) * 100);
            const fcfWidth = Math.min(100, (Math.abs(item.fcf) / netMax) * 100);
            return (
              <div key={item.year} className="space-y-1">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">{item.year}</p>
                <div className="flex h-3 items-center gap-2">
                  <span className="w-10 text-[10px] text-slate-500">净利</span>
                  <div className="h-2 rounded bg-blue-500/85" style={{ width: `${netWidth}%` }} />
                </div>
                <div className="flex h-3 items-center gap-2">
                  <span className="w-10 text-[10px] text-slate-500">FCF</span>
                  <div className="h-2 rounded bg-emerald-500/85" style={{ width: `${fcfWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

