import type { Metadata } from "next";
import CompactEntitlementWidget from "../../../components/report/CompactEntitlementWidget";
import EvidenceAnchorsPanel from "../../../components/report/EvidenceAnchorsPanel";
import FinancialDeepDivePanel from "../../../components/report/FinancialDeepDivePanel";
import FinancialStatementsPanel from "../../../components/report/FinancialStatementsPanel";
import ReportActionButtons from "../../../components/report/ReportActionButtons";
import ThemeToggle from "../../../components/theme/ThemeToggle";
import { normalizeChineseInstitutionalReport } from "../../../lib/report/chinese-template";
import type { InstitutionalReport } from "../../../lib/report/types";
import { getSupabaseAdmin } from "../../../lib/server/supabase-admin";

export const runtime = "nodejs";

interface PageProps {
  params: { reportId: string } | Promise<{ reportId: string }>;
}

function buildSectionId(title: string, index: number): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `section-${index + 1}-${safe || "content"}`;
}

function formatGeneratedAt(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function toPointsText(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/^[-*•\s]+/, "").trim();
    if (!clean) continue;
    out.push(clean);
    if (out.length >= 3) break;
  }
  return out;
}

async function getReport(reportId: string): Promise<InstitutionalReport | null> {
  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("reports")
    .select("id,title,stock_code,stock_name,html_url,generated_at,payload")
    .eq("id", reportId)
    .maybeSingle();

  if (!data) return null;
  const payload = (data.payload || {}) as Partial<InstitutionalReport>;
  const report: InstitutionalReport = {
    id: data.id,
    title: payload.title || data.title,
    generatedAt: data.generated_at,
    lang: "zh-CN",
    htmlUrl: data.html_url,
    stock: payload.stock || {
      code: data.stock_code,
      name: data.stock_name,
      market: "CN",
    },
    sections: payload.sections || [],
    charts: payload.charts || [],
    disclaimer: payload.disclaimer,
    deepDiveSignals: payload.deepDiveSignals,
    financialStatements: payload.financialStatements,
    fraudSignals: payload.fraudSignals,
    macroSnapshot: payload.macroSnapshot,
    dataQuality: payload.dataQuality,
    supplementaryData: payload.supplementaryData,
    evidenceAnchors: payload.evidenceAnchors,
  };
  return normalizeChineseInstitutionalReport(report);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reportId } = await Promise.resolve(params);
  const report = await getReport(reportId);
  if (!report) {
    return {
      title: "报告未找到 | AIFinView",
      description: "机构级中文研报",
    };
  }

  const description = `${report.stock.name}（${report.stock.code}）机构级中文研报，覆盖投资要点、基本面、估值模型、行业比较、消息面、风险与结论。`;
  return {
    title: `${report.stock.name} ${report.stock.code} 机构研报 | AIFinView`,
    description,
    openGraph: {
      type: "article",
      locale: "zh_CN",
      title: report.title,
      description,
    },
  };
}

const LEFT_NAV_ITEMS = [
  { key: "invest", title: "投资要点", icon: "◎" },
  { key: "fundamental", title: "基本面", icon: "◈" },
  { key: "valuation", title: "估值模型", icon: "◉" },
  { key: "industry", title: "行业比较", icon: "▣" },
  { key: "news", title: "消息面", icon: "▤" },
  { key: "risk", title: "风险", icon: "⚑" },
  { key: "conclusion", title: "结论", icon: "✦" },
];

const AGENT_TEAM = [
  "数据搜集代理",
  "财务分析代理",
  "估值建模代理",
  "行业研究代理",
  "消息解读代理",
  "风险评估代理",
  "结论生成代理",
  "主编（人类）",
];

export default async function ReportDetailPage({ params }: PageProps) {
  const { reportId } = await Promise.resolve(params);
  const report = await getReport(reportId);

  if (!report) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-slate-900 dark:text-slate-100">
        未找到报告：{reportId}
      </main>
    );
  }

  const sectionNav = report.sections.map((section, index) => ({
    title: section.title,
    id: buildSectionId(section.title, index),
  }));

  const evidenceRows = (report.evidenceAnchors || []).slice(0, 6);
  const newsCount = report.supplementaryData?.news.count || 0;
  const annCount = report.supplementaryData?.announcements.count || 0;
  const peerCount = report.supplementaryData?.industry.peers.length || 0;
  const latestPrice = report.supplementaryData?.prices.latest || null;
  const return12m = report.supplementaryData?.prices.return12m || null;

  const riskRows =
    report.fraudSignals && report.fraudSignals.length > 0
      ? report.fraudSignals.slice(0, 4).map((item) => ({
          label: item.title,
          level: item.level === "high" ? "中风险" : "低风险",
        }))
      : [
          { label: "中美贸易摩擦升级", level: "中风险" },
          { label: "全球消费电子需求放缓", level: "中风险" },
          { label: "核心供应链中断风险", level: "低风险" },
          { label: "汇率波动风险（USD/CNY）", level: "低风险" },
        ];

  const reportJsonLd = {
    "@context": "https://schema.org",
    "@type": "Report",
    inLanguage: "zh-CN",
    headline: report.title,
    datePublished: report.generatedAt,
    dateModified: report.generatedAt,
    about: {
      "@type": "Corporation",
      name: report.stock.name,
      tickerSymbol: report.stock.code,
    },
    author: {
      "@type": "Organization",
      name: "AIFinView Agentic Research Desk",
    },
    keywords: ["投资要点", "基本面", "估值模型", "行业比较", "消息面", "风险", "结论", "中文研报"],
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 text-slate-900 dark:text-slate-100 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reportJsonLd) }} />

      <header className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <a href="/" className="text-2xl font-bold tracking-tight">
              AIFinView
            </a>
            <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex dark:text-slate-300">
              <a href="/">首页</a>
              <a href="#" className="font-semibold text-blue-600 dark:text-blue-300">
                研报中心
              </a>
              <a href="#">数据中心</a>
              <a href="#">策略工具</a>
              <a href="/account">会员中心</a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value="搜索股票 / 行业 / 研报"
              className="w-[300px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="space-y-4">
          <section className="sticky top-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="mb-3 text-lg font-semibold">报告目录</h2>
            <nav className="space-y-2">
              {LEFT_NAV_ITEMS.map((item) => {
                const matched = sectionNav.find((s) => s.title === item.title);
                return (
                  <a
                    key={item.key}
                    href={`#${matched?.id || ""}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="text-blue-500">{item.icon}</span>
                    <span>{item.title}</span>
                  </a>
                );
              })}
            </nav>
          </section>
        </aside>

        <article className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-300">机构级中文研报</p>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight">
                  {report.stock.name} <span className="text-slate-500">{report.stock.code}</span>
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  生成时间：{formatGeneratedAt(report.generatedAt)} ｜ 研究机构：AIFinView 研究院
                </p>
              </div>
              <div className="min-w-[280px] rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {report.stock.name} <span className="ml-1">{report.stock.code}</span>
                </p>
                <p className="mt-1 text-4xl font-semibold text-rose-600 dark:text-rose-300">{formatNumber(latestPrice)}</p>
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">
                  {return12m === null ? "--" : `${return12m >= 0 ? "+" : ""}${(return12m * 100).toFixed(2)}%`} (12M)
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <p>新闻条数：{newsCount}</p>
                  <p>公告条数：{annCount}</p>
                  <p>同业家数：{peerCount}</p>
                  <p>市场：{report.stock.market}</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <ReportActionButtons reportId={report.id} htmlUrl={report.htmlUrl} showTitle={false} compact />
            </div>
          </section>

          <FinancialDeepDivePanel
            yearly={report.deepDiveSignals?.yearly}
            cumulative={report.deepDiveSignals?.cumulative}
            retainedRoiPercent={report.deepDiveSignals?.retained_roi_percent}
          />

          <FinancialStatementsPanel statements={report.financialStatements} />

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="mb-3 text-lg font-semibold">七段核心结论</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.sections.map((section, index) => {
                const sectionId = sectionNav[index]?.id || buildSectionId(section.title, index);
                const points = toPointsText(section.content.split(/\n+/));
                return (
                  <article
                    key={sectionId}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <h3 className="text-base font-semibold">
                      {index + 1}. {section.title}
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {points.map((line, idx) => (
                        <li key={`${sectionId}-point-${idx}`}>• {line}</li>
                      ))}
                    </ul>
                    <a href={`#${sectionId}`} className="mt-2 inline-block text-xs text-blue-600 dark:text-blue-300">
                      阅读全文
                    </a>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
            {report.sections.map((section, index) => {
              const sectionId = sectionNav[index]?.id || buildSectionId(section.title, index);
              return (
                <article key={sectionId} id={sectionId} className="scroll-mt-20 space-y-2">
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                  <div className="space-y-2 text-[15px] leading-7 text-slate-800 dark:text-slate-200">
                    {section.content
                      .split(/\n+/)
                      .map((line, idx) => (line.trim() ? <p key={`${sectionId}-line-${idx}`}>{line}</p> : null))}
                  </div>
                </article>
              );
            })}
          </section>

          <EvidenceAnchorsPanel anchors={report.evidenceAnchors} />

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            {report.disclaimer}
          </section>
        </article>

        <aside className="space-y-4">
          <CompactEntitlementWidget />

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">证据来源</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">查看全部</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                公司公告 <span className="font-semibold">{annCount}</span>
              </p>
              <p className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                新闻资讯 <span className="font-semibold">{newsCount}</span>
              </p>
              <p className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                行业数据 <span className="font-semibold">{peerCount}</span>
              </p>
              <p className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                宏观指标 <span className="font-semibold">{report.macroSnapshot?.indicators?.length || 0}</span>
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              最近更新：{formatGeneratedAt(report.generatedAt)}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="mb-2 text-lg font-semibold">证据锚点 (Evidence Anchors)</h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left">年份</th>
                    <th className="px-2 py-2 text-left">指标</th>
                    <th className="px-2 py-2 text-left">数值</th>
                    <th className="px-2 py-2 text-left">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-2">{row.year}</td>
                      <td className="px-2 py-2">{row.metric}</td>
                      <td className="px-2 py-2">{row.value}</td>
                      <td className="px-2 py-2">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="mb-2 text-lg font-semibold">智能分析团队（8）</h2>
            <div className="space-y-2">
              {AGENT_TEAM.map((agent) => (
                <div key={agent} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 text-emerald-500">●</span>
                  <div>
                    <p className="font-medium">{agent}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">已完成 · 分析链路已落地</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">风险监控</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">查看详情</span>
            </div>
            <ul className="space-y-2">
              {riskRows.map((risk) => (
                <li key={risk.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">• {risk.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      risk.level === "中风险"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    }`}
                  >
                    {risk.level}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

