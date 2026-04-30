"use client";

import { useTheme, type ThemeMode } from "./ThemeProvider";

const OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: "system", label: "跟随系统" },
  { mode: "light", label: "浅色" },
  { mode: "dark", label: "深色" },
];

export default function ThemeToggle() {
  const { mode, resolvedTheme, setMode } = useTheme();

  return (
    <div className="rounded-2xl border border-[var(--line-default)] bg-[color-mix(in_oklab,var(--bg-card)_82%,transparent)] p-2 text-xs shadow-[var(--shadow-soft)] backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between px-2 text-[11px]">
        <span className="text-[var(--text-muted)]">主题</span>
        <span className="rounded-full border border-[var(--line-default)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[var(--text-secondary)]">
          {resolvedTheme === "dark" ? "深色" : "浅色"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] p-1">
        {OPTIONS.map((option) => {
          const active = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className={`rounded-lg px-2 py-1.5 font-medium transition ${
                active
                  ? "bg-[var(--brand-primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-white/70 dark:hover:bg-slate-800/70"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
