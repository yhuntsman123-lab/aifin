"use client";

import { useEffect, useMemo, useState } from "react";

interface EvidenceAnchor {
  id: string;
  sectionTitle: string;
  claim: string;
  year: string;
  metric: string;
  value: string;
  source: string;
  note?: string;
}

interface Props {
  anchors?: EvidenceAnchor[];
}

export default function EvidenceAnchorsPanel({ anchors = [] }: Props) {
  const sections = useMemo(() => {
    const grouped = new Map<string, EvidenceAnchor[]>();
    for (const item of anchors) {
      if (!grouped.has(item.sectionTitle)) grouped.set(item.sectionTitle, []);
      grouped.get(item.sectionTitle)!.push(item);
    }
    return Array.from(grouped.keys());
  }, [anchors]);

  const [activeSection, setActiveSection] = useState<string>(sections[0] || "");

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSection("");
      return;
    }
    if (!sections.includes(activeSection)) {
      setActiveSection(sections[0]);
    }
  }, [sections, activeSection]);

  const activeAnchors = useMemo(
    () => anchors.filter((item) => item.sectionTitle === activeSection),
    [anchors, activeSection],
  );

  if (anchors.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <h3 className="text-base font-semibold">结论证据锚点</h3>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">暂无结构化证据锚点。</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="sr-only">
        {anchors.map((anchor) => (
          <span key={`jump-${anchor.id}`} id={`evidence-${anchor.id}`} />
        ))}
      </div>
      <h3 className="text-base font-semibold">结论证据锚点（年份+指标）</h3>
      <div className="flex flex-wrap gap-2 text-xs">
        {sections.map((section) => (
          <button
            type="button"
            key={section}
            onClick={() => setActiveSection(section)}
            className={`rounded-full border px-3 py-1 ${
              section === activeSection
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {section}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {activeAnchors.map((anchor) => (
          <article key={anchor.id} className="scroll-mt-24 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
            <p className="font-semibold">{anchor.claim}</p>
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              年份：{anchor.year} ｜ 指标：{anchor.metric} ｜ 数值：{anchor.value}
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">来源：{anchor.source}</p>
            {anchor.note && <p className="mt-1 text-slate-500 dark:text-slate-400">备注：{anchor.note}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
