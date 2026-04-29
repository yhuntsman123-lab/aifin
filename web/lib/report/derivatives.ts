import { CN_REPORT_SECTION_ORDER, normalizeChineseInstitutionalReport } from "./chinese-template";
import type { InstitutionalReport, ReportChart } from "./types";

function chartPlaceholder(chart: ReportChart, index: number): string {
  return `![图${index + 1} ${chart.title}](${chart.imageUrl || chart.imagePath || "图表待生成"})`;
}

function pickCharts(report: InstitutionalReport, count: number): ReportChart[] {
  return report.charts.slice(0, count);
}

function sectionText(report: InstitutionalReport, sectionTitle: string): string {
  return report.sections.find((section) => section.title === sectionTitle)?.content || "";
}

export function buildWechatMarkdown(rawReport: InstitutionalReport): string {
  const report = normalizeChineseInstitutionalReport(rawReport);
  const toc = CN_REPORT_SECTION_ORDER.map((title, idx) => `${idx + 1}. ${title}`).join("\n");
  const sections = report.sections
    .map((section) => {
      const charts = (section.chartKeys || [])
        .map((chartKey) => report.charts.find((chart) => chart.key === chartKey))
        .filter((chart): chart is ReportChart => Boolean(chart))
        .map((chart, idx) => chartPlaceholder(chart, idx))
        .join("\n\n");

      return `## ${section.title}\n\n${section.content}\n${charts ? `\n${charts}\n` : ""}`;
    })
    .join("\n");

  return `# ${report.title}

> 标的：${report.stock.name}（${report.stock.code}）
> 生成时间：${report.generatedAt}

## 目录
${toc}

${sections}

## 免责声明
${report.disclaimer}`;
}

export function buildXiaohongshuNote(rawReport: InstitutionalReport): string {
  const report = normalizeChineseInstitutionalReport(rawReport);
  const keyPoint = sectionText(report, "投资要点");
  const conclusion = sectionText(report, "结论");
  const charts = pickCharts(report, 9)
    .map((chart, idx) => chartPlaceholder(chart, idx))
    .join("\n\n");

  return `# ${report.stock.name}值得继续关注吗？一图看懂机构观点

【一句话结论】
${conclusion || "结论生成中"}

【投资要点】
${keyPoint || "投资要点生成中"}

【图表速览（9图）】
${charts || "图表生成中"}

【风险提示】
${sectionText(report, "风险") || "风险提示生成中"}

#股票分析 #港股 #美股 #A股 #投资研究 #财报解读`;
}

export function buildDouyinScriptPrompt(rawReport: InstitutionalReport): {
  title: string;
  voiceover: string;
  storyboard: string[];
  hashtags: string[];
} {
  const report = normalizeChineseInstitutionalReport(rawReport);
  const keyPoint = sectionText(report, "投资要点");
  const conclusion = sectionText(report, "结论");
  const risk = sectionText(report, "风险");
  const charts = pickCharts(report, 9);

  const storyboard = charts.map(
    (chart, idx) =>
      `镜头${idx + 1}：展示「${chart.title}」，画面停留 3-5 秒，字幕同步口播关键结论。`,
  );

  return {
    title: `${report.stock.name}最新机构观点：3分钟看懂`,
    voiceover: `投资要点：${keyPoint || "要点生成中"}。结论：${conclusion || "结论生成中"}。风险提示：${risk || "风险信息生成中"}。`,
    storyboard:
      storyboard.length > 0
        ? storyboard
        : ["镜头1：封面标题 + 标的代码", "镜头2：投资要点", "镜头3：结论与风险提示"],
    hashtags: ["#股票", "#投资", "#财经", "#研报解读", "#资产配置"],
  };
}

