import AppShell from "../../components/layout/AppShell";
import { getDemoReportSummaries } from "../../lib/report/demo-reports";

export const runtime = "nodejs";

export default function ReportsPage() {
  const demos = getDemoReportSummaries();

  return (
    <AppShell
      title="样例研报中心"
      subtitle="展示苹果、腾讯、宁德时代的机构级中文研报演示版本，包含七段分析、财务深潜、证据锚点与风险监控。"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {demos.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--brand-primary)]">{item.market} 市场</p>
              <span className="text-xs text-[var(--text-muted)]">{item.generatedAt.slice(0, 10)}</span>
            </div>
            <h2 className="text-xl font-semibold">{item.stockName}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{item.stockCode}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{item.teaser}。并覆盖估值模型、行业比较、消息面与风险情景。</p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href={`/reports/${item.id}`}
                className="inline-flex items-center rounded-xl bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(36,93,255,0.32)] hover:brightness-110"
              >
                查看报告全文
              </a>
              <span className="text-xs text-[var(--text-muted)]">含 10Y 深度分析</span>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
