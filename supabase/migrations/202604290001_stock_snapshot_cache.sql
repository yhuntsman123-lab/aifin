-- 单行快照缓存：每个市场+股票仅保留一条财务快照，节省存储并减少重复外部请求
create table if not exists public.stock_financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('CN', 'HK', 'US')),
  stock_code text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (market, stock_code)
);

create index if not exists idx_stock_financial_snapshots_exp
  on public.stock_financial_snapshots(expires_at desc);

alter table public.stock_financial_snapshots enable row level security;

drop policy if exists stock_financial_snapshots_select_auth on public.stock_financial_snapshots;
create policy stock_financial_snapshots_select_auth
on public.stock_financial_snapshots for select
using (auth.role() = 'authenticated');
