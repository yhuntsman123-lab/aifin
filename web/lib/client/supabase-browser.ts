"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient: any = null;

export function getSupabaseBrowserClient(): any {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browserClient = createClient(url, anon);
  return browserClient;
}
