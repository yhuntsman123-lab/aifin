interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ModelProvider = "cloudflare" | "gemini" | "deepseek";

interface ModelCallResult {
  text: string;
  provider: ModelProvider;
  model: string;
}

export async function callCloudflare(messages: ChatMessage[]): Promise<ModelCallResult> {
  const baseUrl = process.env.CLOUDFLARE_AI_BASE_URL;
  const apiKey = process.env.CLOUDFLARE_AI_API_KEY;
  const model = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  if (!baseUrl || !apiKey) {
    throw new Error("Cloudflare AI 未配置");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare AI 调用失败: ${response.status}`);
  }
  const data = (await response.json()) as { result?: { response?: string }; choices?: Array<{ message?: { content?: string } }> };
  const text = data.result?.response || data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Cloudflare AI 返回空结果");
  return { text, provider: "cloudflare", model };
}

export async function callGemini(messages: ChatMessage[]): Promise<ModelCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    throw new Error("Gemini 未配置");
  }

  const userText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini 调用失败: ${response.status}`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("Gemini 返回空结果");
  return { text, provider: "gemini", model };
}

export async function callDeepSeek(messages: ChatMessage[]): Promise<ModelCallResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1/chat/completions";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  if (!apiKey) {
    throw new Error("DeepSeek 未配置");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek 调用失败: ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("DeepSeek 返回空结果");
  return { text, provider: "deepseek", model };
}

export async function callLLMWithFallback(messages: ChatMessage[]): Promise<ModelCallResult> {
  const errors: string[] = [];
  const runners = [callCloudflare, callGemini, callDeepSeek];
  for (const runner of runners) {
    try {
      return await runner(messages);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown");
    }
  }
  throw new Error(`所有模型调用失败: ${errors.join(" | ")}`);
}

export async function callLLMByProvider(provider: ModelProvider, messages: ChatMessage[]): Promise<ModelCallResult> {
  if (provider === "cloudflare") return callCloudflare(messages);
  if (provider === "gemini") return callGemini(messages);
  return callDeepSeek(messages);
}
