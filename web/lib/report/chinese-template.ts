import { CN_INVESTMENT_DISCLAIMER } from "./disclaimer";
import type { InstitutionalReport, ReportSection } from "./types";

export const CN_REPORT_SECTION_ORDER = [
  "投资要点",
  "基本面",
  "估值模型",
  "行业比较",
  "消息面",
  "风险",
  "结论",
] as const;

const EMPTY_SECTION_TEXT = "该部分数据尚在生成中，稍后将自动补全。";

function sectionMap(sections: ReportSection[]): Map<string, ReportSection> {
  return new Map(sections.map((section) => [section.title, section]));
}

export function normalizeChineseInstitutionalReport(
  report: InstitutionalReport,
): InstitutionalReport {
  const mapped = sectionMap(report.sections);

  const normalizedSections: ReportSection[] = CN_REPORT_SECTION_ORDER.map((title) => {
    const existing = mapped.get(title);
    if (existing) {
      return {
        ...existing,
        content: existing.content?.trim() || EMPTY_SECTION_TEXT,
      };
    }
    return {
      title,
      content: EMPTY_SECTION_TEXT,
      chartKeys: [],
    };
  });

  return {
    ...report,
    lang: "zh-CN",
    sections: normalizedSections,
    disclaimer: report.disclaimer?.trim() || CN_INVESTMENT_DISCLAIMER,
  };
}

