"use client";

import type { ReactNode } from "react";
import ThemeToggle from "../theme/ThemeToggle";

interface AppShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  rightSlot?: ReactNode;
}

const NAV = [
  { href: "/", label: "首页" },
  { href: "/", label: "研报中心" },
  { href: "/", label: "数据中心" },
  { href: "/", label: "策略工具" },
  { href: "/account", label: "会员中心" },
];

export default function AppShell(props: AppShellProps) {
  return (
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1720px] px-3 py-3 sm:px-4 md:px-5 lg:px-6">
        <header className="mb-4 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-5">
              <a href="/" className="text-2xl font-bold tracking-tight sm:text-3xl">AIFinView</a>
              <nav className="hidden items-center gap-5 text-sm text-[var(--text-secondary)] md:flex">
                {NAV.map((item) => (
                  <a key={item.label} href={item.href} className="hover:text-[var(--text-primary)]">
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <input
                readOnly
                value="搜索股票 / 行业 / 研报 / 指标 / 宏观"
                className="hidden w-[260px] rounded-xl border border-[var(--line-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] lg:block xl:w-[340px]"
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {(props.title || props.subtitle || props.rightSlot) && (
          <section className="mb-4 rounded-2xl border border-[var(--line-default)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {props.title && <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{props.title}</h1>}
                {props.subtitle && <p className="mt-1 text-sm text-[var(--text-secondary)]">{props.subtitle}</p>}
              </div>
              {props.rightSlot}
            </div>
          </section>
        )}

        {props.children}
      </div>
    </main>
  );
}
