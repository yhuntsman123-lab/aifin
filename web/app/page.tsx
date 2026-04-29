"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/client/supabase-browser";
import ThemeToggle from "../components/theme/ThemeToggle";
import TurnstileWidget from "../components/security/TurnstileWidget";
import EntitlementCard from "../components/account/EntitlementCard";

const SOURCE_CHIPS = [
  { label: "公司公告", count: 128 },
  { label: "年报季报", count: 64 },
  { label: "券商研报", count: 86 },
  { label: "新闻资讯", count: 312 },
  { label: "宏观数据", count: 45 },
  { label: "行业数据", count: 78 },
];

const AGENT_TEAM = [
  { name: "数据搜集代理", status: "已完成 · 来源覆盖全面" },
  { name: "财务分析代理", status: "已完成 · 财务指标解析完毕" },
  { name: "估值建模代理", status: "已完成 · 多模型估值已生成" },
  { name: "行业研究代理", status: "已完成 · 行业对比分析完毕" },
  { name: "消息解读代理", status: "已完成 · 重大事件已解析" },
  { name: "风险评估代理", status: "已完成 · 风险因子识别完毕" },
  { name: "结论生成代理", status: "已完成 · 投资建议已形成" },
  { name: "主编（人类）", status: "已完成 · 报告终审与发布" },
];

const RISK_ITEMS = [
  { text: "中美贸易摩擦升级", level: "中风险" },
  { text: "全球消费电子需求放缓", level: "中风险" },
  { text: "核心供应链中断风险", level: "低风险" },
  { text: "汇率波动风险（USD/CNY）", level: "低风险" },
];

export default function HomePage() {
  const [stockInput, setStockInput] = useState("");
  const [deviceHash] = useState(() => `dev_${Math.random().toString(36).slice(2, 12)}`);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const pollJob = async (jobId: string, token: string) => {
    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(`/api/reports/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "任务查询失败");
      if (payload.status === "completed" && payload.reportId) {
        window.location.href = `/reports/${payload.reportId}`;
        return;
      }
      if (payload.status === "failed") {
        throw new Error(payload.errorMessage || "报告生成失败");
      }
      setMessage(`任务进行中：${payload.status}`);
    }
    throw new Error("生成超时，请稍后在任务列表重试");
  };

  const onGenerate = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
        throw new Error("请先完成人机验证");
      }
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("请先登录后再生成报告");

      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockInput,
          stockName: stockInput,
          deviceHash,
          turnstileToken,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "创建任务失败");

      if (payload.status === "completed" && payload.reportId) {
        window.location.href = `/reports/${payload.reportId}`;
        return;
      }

      setMessage(`任务已创建：${payload.jobId}，正在生成...`);
      await pollJob(payload.jobId, token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setTurnstileReset((v) => v + 1);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#eef2ff_40%,_#f8fafc)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_40%),linear-gradient(to_bottom,_#020617,_#0b1220_45%,_#020617)] dark:text-slate-100">
      <div className="mx-auto max-w-[1420px] px-4 pb-10 pt-4 md:px-6">
        <header className="mb-4 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">AIFinView</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">以证据为先的机构级投研平台</p>
              </div>
              <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex dark:text-slate-300">
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
                value="搜索股票 / 行业 / 关键词"
                className="w-[280px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">Agentic Report Studio</p>
                  <h2 className="text-2xl font-semibold">机构级中文研报生成台</h2>
                </div>
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                  多源校验已启用
                </span>
              </div>
              <label className="mb-2 block text-sm font-medium">输入股票名称 / 代码 / 简称</label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={stockInput}
                  onChange={(event) => setStockInput(event.target.value)}
                  placeholder="例如：腾讯控股 / 00700 / TSLA / 600519"
                  className="min-w-[300px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={loading || !stockInput.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60 dark:bg-blue-500"
                >
                  {loading ? "生成中..." : "生成研报"}
                </button>
              </div>
              <TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} action="report_generate" />
              {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">证据来源矩阵</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">实时聚合</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {SOURCE_CHIPS.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                    <span className="ml-2 font-semibold text-blue-700 dark:text-blue-300">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
              <h3 className="mb-3 text-lg font-semibold">智能分析团队（8）</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {AGENT_TEAM.map((agent, index) => (
                  <div key={agent.name} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <p className="font-medium">
                      {index + 1}. {agent.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{agent.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <EntitlementCard />

            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg font-semibold">风险监控</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">动态更新</span>
              </div>
              <ul className="space-y-2">
                {RISK_ITEMS.map((item) => (
                  <li key={item.text} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span className="text-sm">{item.text}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.level === "中风险"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      }`}
                    >
                      {item.level}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4 shadow-sm dark:border-amber-700/60 dark:bg-amber-900/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">股票AI筛选工具</h3>
                  <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                    待上线：按财务质量、估值分位、行业景气度、事件催化自动筛选候选池。
                  </p>
                </div>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-800/70 dark:text-amber-100">
                  Coming Soon
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
