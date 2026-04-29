"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (target: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId?: string) => void;
    };
  }
}

interface Props {
  onVerify: (token: string) => void;
  resetSignal?: number;
  action?: string;
}

const SCRIPT_ID = "cf-turnstile-api-script";

export default function TurnstileWidget({ onVerify, resetSignal = 0, action = "submit" }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const mount = () => {
      if (!window.turnstile || !containerRef.current) return false;
      if (widgetIdRef.current && window.turnstile.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        action,
        callback: (token: string) => onVerify(token),
        "expired-callback": () => onVerify(""),
        "error-callback": () => onVerify(""),
      });
      return true;
    };

    if (mount()) return;

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => {
      mount();
    };
    script.addEventListener("load", handleLoad);
    return () => {
      script?.removeEventListener("load", handleLoad);
    };
  }, [siteKey, action, onVerify]);

  useEffect(() => {
    if (!widgetIdRef.current) return;
    if (!window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    onVerify("");
  }, [resetSignal, onVerify]);

  if (!siteKey) return null;

  return (
    <div className="mt-3 space-y-1">
      <div ref={containerRef} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">已启用 Cloudflare Turnstile 防刷校验。</p>
    </div>
  );
}

