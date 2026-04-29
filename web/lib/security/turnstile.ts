export async function verifyTurnstileToken(params: {
  token?: string;
  remoteIp?: string | null;
}): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    // 未配置时放行，方便本地联调；生产建议必须配置。
    return true;
  }

  if (!params.token) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", params.token);
  if (params.remoteIp) {
    body.set("remoteip", params.remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    return false;
  }
  const result = (await response.json()) as { success?: boolean };
  return Boolean(result.success);
}

