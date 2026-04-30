import AppShell from "../../components/layout/AppShell";

export default function DataCenterPage() {
  return (
    <AppShell title="数据中心" subtitle="多源数据血缘与可用性面板（演示版）：财报三张表、公告、新闻、行业、宏观均可追溯。">
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          ["财报数据", "覆盖 US/CN/HK 近10年财务三张表，缺失显式标注，禁止估算。"],
          ["公告与新闻", "SEC/巨潮/东财/Yahoo/Finnhub 多通道，支持来源追溯。"],
          ["宏观雷达", "M0/M1/M2/CPI/PPI/PMI/GDP + 美债/VIX/DXY/大宗商品。"],
        ].map((item) => (
          <article key={item[0]} className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold">{item[0]}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{item[1]}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
