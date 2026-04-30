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
    <div className="rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] p-2 text-xs shadow-[var(--shadow-soft)] backdrop-blur">
      <div className="mb-1 px-2 text-[11px] text-[var(--text-muted)]">
        主题：{resolvedTheme === "dark" ? "深色" : "浅色"}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {OPTIONS.map((option) => {
          const active = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className={`rounded-md px-2 py-1 transition ${
                active
                  ? "bg-[var(--text-primary)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
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
