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
    <div className="rounded-lg border border-slate-300 bg-white/85 p-1 text-xs backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mb-1 px-2 text-[11px] text-slate-500 dark:text-slate-400">
        主题：{resolvedTheme === "dark" ? "深色" : "浅色"}
      </div>
      <div className="flex gap-1">
        {OPTIONS.map((option) => {
          const active = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className={`rounded-md px-2 py-1 transition ${
                active
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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

