"use client";

import { useMemo, useState } from "react";

type ActionType = "wechat" | "xiaohongshu" | "douyin" | "pdf";

interface DouyinPrompt {
  title: string;
  voiceover: string;
  storyboard: string[];
  hashtags: string[];
}

interface ActionResult {
  taskId: string;
  status: string;
  mode?: "mp4" | "prompt";
  outputUrl?: string;
  markdown?: string;
  note?: string;
  prompt?: DouyinPrompt;
}

interface TaskRow {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  output_url?: string | null;
  output_text?: string | null;
  output_json?: Record<string, unknown> | null;
  error_message?: string | null;
}

interface Props {
  reportId: string;
  htmlUrl?: string;
  showTitle?: boolean;
  compact?: boolean;
}

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

function normalizeDouyinPrompt(input: unknown): DouyinPrompt | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const storyboard = Array.isArray(raw.storyboard) ? raw.storyboard.map((item) => String(item)) : [];
  const hashtags = Array.isArray(raw.hashtags) ? raw.hashtags.map((item) => String(item)) : [];
  const title = String(raw.title || "").trim();
  const voiceover = String(raw.voiceover || raw.script || "").trim();
  if (!title && !voiceover && storyboard.length === 0) return undefined;
  return {
    title: title || "抖音短视频脚本",
    voiceover,
    storyboard: storyboard.length > 0 ? storyboard : ["镜头1：封面", "镜头2：要点", "镜头3：结论与风险"],
    hashtags: hashtags.length > 0 ? hashtags : ["#股票", "#财经", "#投资", "#研报解读"],
  };
}

function taskToResult(action: ActionType, task: TaskRow): ActionResult {
  if (action === "douyin") {
    const prompt = normalizeDouyinPrompt(task.output_json);
    if (task.output_url) {
      return {
        taskId: task.id,
        status: task.status,
        mode: "mp4",
        outputUrl: task.output_url,
      };
    }
    return {
      taskId: task.id,
      status: task.status,
      mode: "prompt",
      prompt,
      note: task.output_text || undefined,
    };
  }

  return {
    taskId: task.id,
    status: task.status,
    outputUrl: task.output_url || undefined,
    markdown: task.output_text || undefined,
  };
}

function responseToResult(action: ActionType, payload: Record<string, unknown>): ActionResult {
  if (action === "wechat") {
    return {
      taskId: String(payload.taskId || ""),
      status: String(payload.status || "completed"),
      outputUrl: typeof payload.outputUrl === "string" ? payload.outputUrl : undefined,
      markdown: typeof payload.markdown === "string" ? payload.markdown : undefined,
    };
  }
  if (action === "xiaohongshu") {
    return {
      taskId: String(payload.taskId || ""),
      status: String(payload.status || "completed"),
      outputUrl: typeof payload.outputUrl === "string" ? payload.outputUrl : undefined,
      markdown: typeof payload.note === "string" ? payload.note : undefined,
    };
  }
  if (action === "pdf") {
    return {
      taskId: String(payload.taskId || ""),
      status: String(payload.status || "completed"),
      outputUrl: typeof payload.outputUrl === "string" ? payload.outputUrl : undefined,
    };
  }
  return {
    taskId: String(payload.taskId || ""),
    status: String(payload.status || "completed"),
    mode: (payload.mode as "mp4" | "prompt" | undefined) || "prompt",
    outputUrl: typeof payload.outputUrl === "string" ? payload.outputUrl : undefined,
    prompt: normalizeDouyinPrompt(payload.prompt),
  };
}

export default function ReportActionButtons({ reportId, htmlUrl, showTitle = true, compact = false }: Props) {
  const [loading, setLoading] = useState<Record<ActionType, boolean>>({
    wechat: false,
    xiaohongshu: false,
    douyin: false,
    pdf: false,
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const douyinPrompt = useMemo(() => {
    if (!result?.prompt) return "";
    const { title, voiceover, storyboard, hashtags } = result.prompt;
    return `标题：${title}\n\n口播：${voiceover}\n\n分镜：\n${storyboard
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n")}\n\n话题：${hashtags.join(" ")}`;
  }, [result]);

  const pollTask = async (action: ActionType, taskId: string, maxRounds = 40): Promise<ActionResult | null> => {
    for (let i = 0; i < maxRounds; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(`/api/reports/${reportId}/actions/${action}`);
      const payload = (await response.json()) as { tasks?: TaskRow[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "查询任务状态失败");
      }
      const tasks = payload.tasks || [];
      const task = tasks.find((item) => item.id === taskId) || tasks[0];
      if (!task) continue;
      if (task.status === "completed") {
        return taskToResult(action, task);
      }
      if (task.status === "failed") {
        throw new Error(task.error_message || "任务失败");
      }
    }
    return null;
  };

  const copyPromptToClipboard = async (prompt?: DouyinPrompt) => {
    if (!prompt) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(
      `标题：${prompt.title}\n口播：${prompt.voiceover}\n分镜：${prompt.storyboard.join("\n")}\n话题：${prompt.hashtags.join(" ")}`,
    );
  };

  const callAction = async (action: ActionType, body: Record<string, unknown> = {}) => {
    setLoading((prev) => ({ ...prev, [action]: true }));
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/reports/${reportId}/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as Record<string, unknown> & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `生成失败（${response.status}）`);
      }

      const immediate = responseToResult(action, payload);

      if (action === "douyin" && immediate.status === "queued") {
        setNotice("抖音视频已进入异步队列，正在生成...");
        const polled = await pollTask("douyin", immediate.taskId, 35);
        if (polled) {
          setResult(polled);
          if (polled.mode === "prompt") {
            await copyPromptToClipboard(polled.prompt);
            setNotice("MP4 任务已降级为提示词，已自动复制到剪贴板。");
          } else {
            setNotice("MP4 生成完成，可直接下载。");
          }
          return;
        }

        setNotice("MP4 任务超时，已自动降级为提示词模式。");
        const fallbackResp = await fetch(`/api/reports/${reportId}/actions/douyin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "prompt" }),
        });
        const fallbackPayload = (await fallbackResp.json()) as Record<string, unknown> & { error?: string };
        if (!fallbackResp.ok) {
          throw new Error(fallbackPayload.error || "提示词降级失败");
        }
        const fallbackResult = responseToResult("douyin", fallbackPayload);
        setResult(fallbackResult);
        await copyPromptToClipboard(fallbackResult.prompt);
        return;
      }

      setResult(immediate);
      if (action === "douyin" && immediate.mode === "prompt") {
        await copyPromptToClipboard(immediate.prompt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  return (
    <section
      className={
        compact
          ? "space-y-3"
          : "space-y-3 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
      }
    >
      {showTitle && <h3 className="text-base font-semibold">报告衍生内容</h3>}
      <div className="flex flex-wrap gap-2">
        <a
          className={`${BUTTON_BASE} border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
          href={htmlUrl || "#"}
          target="_blank"
          rel="noreferrer"
        >
          在线阅读
        </a>

        <button
          className={`${BUTTON_BASE} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`}
          onClick={() => callAction("wechat")}
          disabled={loading.wechat}
          type="button"
        >
          一键生成公众号文章
        </button>

        <button
          className={`${BUTTON_BASE} border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
          onClick={() => callAction("xiaohongshu")}
          disabled={loading.xiaohongshu}
          type="button"
        >
          一键生成小红书笔记
        </button>

        <button
          className={`${BUTTON_BASE} border-red-600 bg-red-600 text-white hover:bg-red-500 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400`}
          onClick={() => callAction("douyin", { mode: "mp4" })}
          disabled={loading.douyin}
          type="button"
        >
          一键生成抖音视频
        </button>

        <button
          className={`${BUTTON_BASE} border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
          onClick={() => callAction("pdf")}
          disabled={loading.pdf}
          type="button"
        >
          导出 PDF
        </button>
      </div>

      {notice && <p className="text-sm text-blue-600 dark:text-blue-300">{notice}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result?.outputUrl && (
        <a
          className="text-sm text-blue-600 underline dark:text-blue-400"
          href={result.outputUrl}
          target="_blank"
          rel="noreferrer"
        >
          下载生成结果
        </a>
      )}

      {douyinPrompt && (
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p className="mb-2 font-medium">已生成抖音提示词（已自动复制）</p>
          <pre className="whitespace-pre-wrap">{douyinPrompt}</pre>
        </div>
      )}
    </section>
  );
}
