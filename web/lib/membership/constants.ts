export type UserTier = "free" | "vip" | "svip";

export const DAILY_LIMIT_BY_TIER: Record<UserTier, number> = {
  free: 1,
  vip: 10,
  svip: 20,
};

export const ENTITLEMENT_DAYS = {
  vip: 30,
  svip: 365,
} as const;

export const PRICE_CODE_BY_TIER = {
  vip: "vip_30d",
  svip: "svip_365d",
} as const;

