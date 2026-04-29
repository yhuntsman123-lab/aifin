"use client";

import { useMemo, useState } from "react";
import EntitlementCard from "../components/account/EntitlementCard";
import TurnstileWidget from "../components/security/TurnstileWidget";
import ThemeToggle from "../components/theme/ThemeToggle";
import { getSupabaseBrowserClient } from "../lib/client/supabase-browser";

type JobStage = "idle" | "queued" | "processing" | "completed" | "failed";

const AGENT_STEPS = [
  "投资要点 Agent",
  "基本面 Agent",
  "估值模型 Agent",
  "行业比较 Agent",
  "消息面 Agent",
  "风险 Agent",
  "结论 Agent",
  "主编 Agent",
];

const QUALITY_METRICS = [
  { label: "证据覆盖率", value: "98%", tone: "text-emerald-600 dark:text-emerald-300" },
  { label: "反幻觉校验", value: "已启用", tone: "text-blue-600 dark:text-blue-300" },
  { label: "结构化锚点", value: "7段", tone: "text-slate-700 dark:text-slate-200" },
  { label: "模型路由", value: "3通道", tone: "text-slate-700 dark:text-slate-200" },
];

function resolveStepState(step: number, progress: number, stage: JobStage) {
  if (stage === "failed") return "failed";
  if (stage === "completed") return "completed";
  if (step < progress) return "completed";
  if (step === progress && (stage === "queued" || stage === "processing")) return "running";
  return "waiting";
}

export default function HomePage() {
  const [stockInput, setStockInput] = useState("");
  const [deviceHash] = useState(() => `dev_${Math.random().toString(36).slice(2, 12)}`);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobStage, setJobStage] = useState<JobStage>("idle");
  const [agentProgress, setAgentProgress] = useState(0);

  const progressPct = useMemo(() => {
    if (jobStage === "completed") return 100;
    return Math.round((agentProgress / Math.max(AGENT_STEPS.length, 1)) * 100);
  }, [agentProgress, jobStage]);

  const pollJob = async (jobId: string, token: string) => {
    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(`/api/reports/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "任务查询失败");

      setJobStage(payload.status === "failed" ? "failed" : payload.status === "completed" ? "completed" : "processing");
      setAgentProgress(Math.min(AGENT_STEPS.length - 1, Math.floor((i + 1) / 6)));

      if (payload.status === "completed" && payload.reportId) {
        setAgentProgress(AGENT_STEPS.length);
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
    setJobStage("queued");
    setAgentProgress(0);
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
        setJobStage("completed");
        setAgentProgress(AGENT_STEPS.length);
        window.location.href = `/reports/${payload.reportId}`;
        return;
      }

      setMessage(`任务已创建：${payload.jobId}，正在生成...`);
      await pollJob(payload.jobId, token);
    } catch (error) {
      setJobStage("failed");
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setTurnstileReset((v) => v + 1);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.10),_transparent_45%),linear-gradient(to_bottom,_#f8fafc,_#eef2ff_38%,_#f8fafc)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.14),_transparent_45%),linear-gradient(to_bottom,_#020617,_#0b1220_45%,_#020617)] dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 md:px-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-7">
              <a href="/" className="text-3xl font-bold tracking-tight">AIFinView</a>
              <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex dark:text-slate-300">
                <a href="/" className="font-semibold text-blue-600 dark:text-blue-300">首页</a>
                <a href="#report-studio">研报中心</a>
                <a href="#quality-center">数据中心</a>
                <a href="#agent-workflow">策略工具</a>
                <a href="/account">会员中心</a>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value="搜索股票 / 行业 / 研报 / 关键词"
                className="w-[320px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <section id="report-studio" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Institutional Chinese Research</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">机构级中文研报，证据驱动，拒绝幻觉</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              覆盖中港美股票，7-Agent 并发分析与主编统一润色。所有结论需绑定证据锚点，缺失数据明确标注“禁止估算”。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={stockInput}
                onChange={(event) => setStockInput(event.target.value)}
                placeholder="输入股票名称 / 代码 / 简称，例如：AAPL / 00700 / 600519"
                className="min-w-[320px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={onGenerate}
                disabled={loading || !stockInput.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "生成中..." : "立即生成研报"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/account" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">查看会员权益</a>
              <a href="/register" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">注册账号</a>
            </div>
            <div className="mt-3"><TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} action="report_generate" /></div>
            {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold">研报质量中枢</h2>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">96 / 100</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {QUALITY_METRICS.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                    <p className="text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className={`mt-1 font-semibold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
            <EntitlementCard />
          </div>
        </section>

        <section id="agent-workflow" className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">7-Agent 协作工作流（含主编）</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">当前进度：{progressPct}%</span>
          </div>
          <div className="mb-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {AGENT_STEPS.map((name, idx) => {
              const state = resolveStepState(idx, agentProgress, jobStage);
              const tone =
                state === "completed"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : state === "running"
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    : state === "failed"
                      ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300";
              const statusText = state === "completed" ? "已完成" : state === "running" ? "运行中" : state === "failed" ? "失败" : "待命";
              return (
                <div key={name} className={`rounded-lg border px-3 py-2 ${tone}`}>
                  <p className="text-sm font-medium">{idx + 1}. {name}</p>
                  <p className="mt-1 text-xs">{statusText}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="quality-center" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="text-base font-semibold">证据锚点</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">每个关键结论都绑定 年份 / 指标 / 数值 / 来源，支持审计追溯。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="text-base font-semibold">数据血缘追踪</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">AkShare、Tushare、Longbridge、yfinance、FRED、东财多源校验。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="text-base font-semibold">反幻觉规则</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">宏观/行业/公告数据缺失时强制输出“数据缺失，禁止估算”。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="text-base font-semibold">宏观雷达与行业温度</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">M1/M2/CPI/PPI/PMI/GDP + 跨资产雷达 + 行业板块温度同步注入 Agent。</p>
          </article>
        </section>
      </div>
    </main>
  );
}
