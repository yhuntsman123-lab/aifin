"use client";

import { useMemo, useState } from "react";
import ThemeToggle from "../components/theme/ThemeToggle";
import TurnstileWidget from "../components/security/TurnstileWidget";
import { getSupabaseBrowserClient } from "../lib/client/supabase-browser";

type JobStage = "idle" | "queued" | "processing" | "completed" | "failed";

const AGENTS = ["投资要点", "基本面", "估值模型", "行业比较", "消息面", "风险", "结论", "主编 Agent"];

const QUALITY_BLOCKS = [
  { title: "证据锚点", desc: "年份/指标/来源全链路可追溯" },
  { title: "数据血缘追踪", desc: "AkShare、Tushare、Longbridge、yfinance、FRED、东财" },
  { title: "反幻觉规则", desc: "缺失数据禁止估算，自动显式提示" },
  { title: "宏观雷达", desc: "M1/M2/CPI/PPI/PMI/GDP + 跨资产" },
  { title: "行业温度", desc: "板块热度、主力净流入、上涨/下跌家数" },
];

function stateFor(index: number, progress: number, stage: JobStage) {
  if (stage === "failed") return "failed";
  if (stage === "completed") return "done";
  if (index < progress) return "done";
  if (index === progress && (stage === "queued" || stage === "processing")) return "running";
  return "wait";
}

export default function HomePage() {
  const [stockInput, setStockInput] = useState("");
  const [deviceHash] = useState(() => `dev_${Math.random().toString(36).slice(2, 12)}`);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobStage, setJobStage] = useState<JobStage>("idle");
  const [progress, setProgress] = useState(0);

  const pct = useMemo(() => {
    if (jobStage === "completed") return 100;
    return Math.round((progress / Math.max(AGENTS.length, 1)) * 100);
  }, [progress, jobStage]);

  const pollJob = async (jobId: string, token: string) => {
    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(`/api/reports/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "任务查询失败");

      setJobStage(payload.status === "failed" ? "failed" : payload.status === "completed" ? "completed" : "processing");
      setProgress(Math.min(AGENTS.length - 1, Math.floor((i + 1) / 5)));

      if (payload.status === "completed" && payload.reportId) {
        setProgress(AGENTS.length);
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
    setProgress(0);
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stockInput, stockName: stockInput, deviceHash, turnstileToken }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "创建任务失败");

      if (payload.status === "completed" && payload.reportId) {
        setJobStage("completed");
        setProgress(AGENTS.length);
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
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
        <header className="mb-4 rounded-3xl border border-[var(--line-default)] bg-[color-mix(in_oklab,var(--bg-card)_88%,transparent)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-6">
              <a href="/" className="text-3xl font-bold tracking-tight sm:text-4xl">AIFinView</a>
              <nav className="hidden items-center gap-6 text-sm text-[var(--text-secondary)] md:flex">
                <a href="/" className="font-semibold text-[var(--brand-primary)]">首页</a>
                <a href="/">研报中心</a>
                <a href="/">数据中心</a>
                <a href="/">策略工具</a>
                <a href="/account">会员中心</a>
              </nav>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <input readOnly value="搜索股票 / 行业 / 研报 / 指标 / 宏观" className="hidden w-[260px] rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] lg:block xl:w-[320px]" />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-[var(--line-default)] bg-[color-mix(in_oklab,var(--bg-card)_90%,transparent)] p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div>
                  <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.4rem] lg:text-[2.95rem]">机构级中文研报，<br />证据驱动，拒绝幻觉</h1>
                  <p className="mt-3 max-w-2xl text-base text-[var(--text-secondary)]">覆盖中 / 港 / 美主要市场，结合多源数据与严格验证体系，为机构投资者提供可验证、可追溯、可复用的研究结论。</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={onGenerate} disabled={loading || !stockInput.trim()} className="rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(36,93,255,0.32)] hover:brightness-110 disabled:opacity-60">{loading ? "生成中..." : "立即生成研报"}</button>
                    <a href="/reports" className="rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">查看样例报告</a>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input value={stockInput} onChange={(e) => setStockInput(e.target.value)} placeholder="输入股票名称 / 代码 / 简称（AAPL / 00700 / 600519）" className="w-full min-w-0 flex-1 rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm" />
                  </div>
                  <div className="mt-2"><TurnstileWidget onVerify={setTurnstileToken} resetSignal={turnstileReset} action="report_generate" /></div>
                  {message && <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>}
                </div>

                <div className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-subtle)] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">研报质量评分</h3>
                    <span className="text-xs text-[var(--text-muted)]">评估日期：2026-05-22</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-[var(--success)] bg-[var(--bg-card)] text-center sm:mx-0">
                      <div><p className="text-5xl font-bold leading-none">96</p><p className="text-sm text-[var(--text-muted)]">/100</p></div>
                    </div>
                    <div className="space-y-3 pt-1 text-sm">
                      {["数据完整性 98/100","证据覆盖率 93/100","模型一致性 95/100","风险揭示充分度 94/100"].map((row) => (
                        <div key={row} className="flex items-center justify-between border-b border-[var(--line-default)] pb-1"><span>{row.split(" ")[0]}</span><span className="font-semibold text-[var(--success)]">{row.split(" ")[1]}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line-default)] bg-[color-mix(in_oklab,var(--bg-card)_92%,transparent)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-sm" id="agent-workflow">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-2xl font-semibold sm:text-3xl">7-Agent 协作工作流</h2>
                <span className="text-sm text-[var(--text-muted)]">总进度：{pct}%</span>
              </div>
              <div className="mb-3 h-2 rounded-full bg-[var(--line-default)]"><div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${pct}%` }} /></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {AGENTS.map((name, index) => {
                  const st = stateFor(index, progress, jobStage);
                  const cls = st === "done" ? "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-900/20" : st === "running" ? "border-blue-300 bg-blue-50/80 dark:bg-blue-900/20" : st === "failed" ? "border-rose-300 bg-rose-50/80 dark:bg-rose-900/20" : "border-[var(--line-default)] bg-[var(--bg-subtle)]";
                  const txt = st === "done" ? "已完成" : st === "running" ? "运行中" : st === "failed" ? "失败" : "等待中";
                  return <div key={name} className={`rounded-xl border px-3 py-2 text-sm ${cls}`}><p className="font-medium">{String(index + 1).padStart(2, "0")} {name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{txt}</p></div>;
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {QUALITY_BLOCKS.map((item) => (
                <article key={item.title} className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-soft)]">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.desc}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {["苹果公司（AAPL.O）深度研报", "腾讯控股（0700.HK）跟踪报告", "宁德时代（300750.SZ）分析报告"].map((t) => (
                <article key={t} className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-soft)]">
                  <h3 className="text-sm font-semibold">{t}</h3>
                  <div className="mt-2 h-20 rounded-xl bg-[var(--bg-subtle)]" />
                  <a href="/reports" className="mt-2 inline-block text-xs font-medium text-[var(--brand-primary)]">查看报告全文</a>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-3xl border border-[var(--line-default)] bg-[color-mix(in_oklab,var(--bg-card)_95%,transparent)] p-4 shadow-[var(--shadow-soft)]">
              <h3 className="mb-2 text-lg font-semibold">会员权益</h3>
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] p-3"><div className="flex items-center justify-between"><p className="text-2xl font-bold">FREE</p><span className="text-xs text-[var(--text-muted)]">当前套餐</span></div><p className="mt-2 text-sm text-[var(--text-secondary)]">今日剩余查询次数 1 / 1</p></div>
                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 dark:bg-amber-900/20"><div className="flex items-center justify-between"><p className="text-2xl font-bold">VIP</p><span className="rounded-full bg-[#e2a936] px-2 py-0.5 text-xs text-white">推荐</span></div><p className="mt-2 text-sm text-[var(--text-secondary)]">今日剩余查询次数 10 / 10</p></div>
                <div className="rounded-xl border border-[#20335e] bg-gradient-to-br from-[#1f376b] to-[#1c2847] p-3 text-white"><div className="flex items-center justify-between"><p className="text-2xl font-bold">SVIP</p><span className="text-xs text-blue-100">机构版</span></div><p className="mt-2 text-sm text-blue-100">今日剩余查询次数 20 / 20</p></div>
              </div>
              <a href="/account" className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(36,93,255,0.34)] hover:brightness-110">查看权益详情</a>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
