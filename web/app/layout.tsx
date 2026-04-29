import "./globals.css";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "AIFinView",
    template: "%s | AIFinView",
  },
  description: "机构级中文研报平台（CN/HK/US）",
  applicationName: "AIFinView",
  robots: {
    index: true,
    follow: true,
  },
};

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const key = 'aifv-theme-mode';
    const saved = localStorage.getItem(key);
    const mode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    const resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
