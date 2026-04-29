/**
 * Cloudflare Queue Consumer
 *
 * 目标：
 * 1) 消费 report 生成任务，回调 Vercel 内部 API 执行 processReportJob
 * 2) 消费 douyin 任务：优先转发到外部 MP4 渲染器；未配置渲染器时自动降级为“提示词完成”
 *
 * 环境变量（Worker）：
 * - APP_INTERNAL_BASE_URL       例如 https://your-app.vercel.app
 * - INTERNAL_QUEUE_SECRET       与 Next.js INTERNAL_QUEUE_SECRET 一致
 * - DOUYIN_RENDER_WEBHOOK_URL   可选，外部渲染器入口（如 GitHub Action/Webhook）
 */

async function postJson(url, secret, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${url} -> ${response.status} ${text}`);
  }
  return response.json().catch(() => ({}));
}

async function handleReportJob(payload, env) {
  if (!payload.jobId) {
    throw new Error("process_report_job 缺少 jobId");
  }
  const url = `${env.APP_INTERNAL_BASE_URL}/api/internal/report-jobs/run`;
  await postJson(url, env.INTERNAL_QUEUE_SECRET, { jobId: payload.jobId });
}

async function handleDouyinJob(payload, env) {
  if (!payload.taskId) {
    throw new Error("douyin_mp4 缺少 taskId");
  }

  // 1) 如果配置了外部渲染器，优先转发过去
  if (env.DOUYIN_RENDER_WEBHOOK_URL) {
    const renderResponse = await fetch(env.DOUYIN_RENDER_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (renderResponse.ok) {
      return;
    }
  }

  // 2) 降级：直接让 Vercel 内部接口把任务写成“提示词模式完成”
  const fallbackUrl = `${env.APP_INTERNAL_BASE_URL}/api/internal/generation-tasks/douyin`;
  await postJson(fallbackUrl, env.INTERNAL_QUEUE_SECRET, {
    taskId: payload.taskId,
    report: payload.report || null,
    prompt: payload.prompt || null,
  });
}

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const payload = typeof message.body === "string" ? JSON.parse(message.body) : message.body;
        const action = payload?.action;

        if (action === "process_report_job") {
          await handleReportJob(payload, env);
          message.ack();
          continue;
        }

        if (action === "douyin_mp4") {
          await handleDouyinJob(payload, env);
          message.ack();
          continue;
        }

        // 未知动作直接 ack，防止死循环
        message.ack();
      } catch (error) {
        console.error("queue message failed", error);
        message.retry();
      }
    }
  },
};

