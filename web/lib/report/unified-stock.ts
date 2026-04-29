import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportedMarket } from "./types";

export interface UnifiedStockCode {
  market: SupportedMarket;
  canonicalCode: string;
  queryKeyword: string;
}

function normalizeCN(code: string): string {
  const trimmed = code.padStart(6, "0");
  const suffix = trimmed.startsWith("6") || trimmed.startsWith("9") ? "SH" : "SZ";
  return `${trimmed}.${suffix}`;
}

function normalizeHK(code: string): string {
  return `${code.padStart(4, "0")}.HK`;
}

function normalizeUS(code: string): string {
  return code.toUpperCase();
}

function isCNCode(input: string): boolean {
  return /^\d{6}$/.test(input) || /^\d{6}\.(SH|SZ)$/i.test(input);
}

function isHKCode(input: string): boolean {
  return /^\d{1,5}$/.test(input) || /^\d{4}\.HK$/i.test(input);
}

function isUSCode(input: string): boolean {
  return /^[A-Za-z]{1,5}$/.test(input);
}

export function normalizeStockInput(input: string): UnifiedStockCode {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    throw new Error("股票输入不能为空");
  }

  if (/^\d{6}\.(SH|SZ)$/i.test(trimmed)) {
    return { market: "CN", canonicalCode: trimmed, queryKeyword: trimmed };
  }
  if (/^\d{4}\.HK$/i.test(trimmed)) {
    return { market: "HK", canonicalCode: trimmed, queryKeyword: trimmed };
  }

  if (isCNCode(trimmed)) {
    return { market: "CN", canonicalCode: normalizeCN(trimmed.replace(/\..+$/, "")), queryKeyword: trimmed };
  }
  if (isHKCode(trimmed) && Number(trimmed) <= 9999) {
    return { market: "HK", canonicalCode: normalizeHK(trimmed.replace(/\..+$/, "")), queryKeyword: trimmed };
  }
  if (isUSCode(trimmed)) {
    return { market: "US", canonicalCode: normalizeUS(trimmed), queryKeyword: trimmed };
  }

  // 名称/简称输入，先返回关键词，后续依赖别名表映射。
  return {
    market: "US",
    canonicalCode: trimmed,
    queryKeyword: trimmed,
  };
}

export async function resolveWithAliasTable(
  client: SupabaseClient,
  input: string,
): Promise<UnifiedStockCode> {
  const normalized = normalizeStockInput(input);

  const { data } = await client
    .from("stock_aliases")
    .select("canonical_code,market")
    .or(`alias.eq.${input},short_name.eq.${input},name.eq.${input}`)
    .limit(1)
    .maybeSingle();

  if (data?.canonical_code && data?.market) {
    return {
      market: data.market as SupportedMarket,
      canonicalCode: data.canonical_code,
      queryKeyword: input,
    };
  }

  return normalized;
}

