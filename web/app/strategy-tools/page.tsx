import AppShell from "../../components/layout/AppShell";

export default function StrategyToolsPage() {
  return (
    <AppShell title="策略工具" subtitle="面向投研与风控的可执行工具（演示版）。">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["股票 AI 筛选器（待上线）", "基于质量因子、估值因子、风险因子构建多维选股。"],
          ["7-Agent 工作流监控", "实时查看每个分析 Agent 的输入证据与输出质量。"],
          ["证据锚点校验", "每条核心结论绑定年份、指标、来源，支持复核。"],
          ["风险情景沙盘", "牛/基准/熊三情景估值与触发条件联动。"],
          ["内容分发工坊", "公众号/小红书/抖音提示词与素材一键生成。"],
          ["合规检测", "缺失数据显式提示、幻觉抑制规则与审计日志。"],
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
