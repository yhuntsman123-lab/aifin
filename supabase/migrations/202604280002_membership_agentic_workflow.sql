-- ============================================================
-- AIFinView: Membership + Billing + Invite + Agentic Workflow
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Profiles / Auth
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  invite_code text unique,
  inviter_user_id uuid references public.profiles(id) on delete set null,
  is_banned boolean not null default false,
  risk_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.profiles (id, email, invite_code)
  values (new.id, new.email, v_code)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------
-- Membership / Usage / Billing / Invite
-- ------------------------------------------------------------
create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('free', 'vip', 'svip')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  source text not null,
  reference text,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_entitlements_user_end
  on public.user_entitlements(user_id, end_at desc);

create table if not exists public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  used_count integer not null default 0,
  limit_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, usage_date)
);

drop trigger if exists trg_daily_usage_updated_at on public.daily_usage;
create trigger trg_daily_usage_updated_at
before update on public.daily_usage
for each row execute function public.set_updated_at();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent text,
  stripe_customer_id text,
  product_code text not null check (product_code in ('vip_30d', 'svip_365d')),
  amount integer,
  currency text not null default 'cny',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null,
  invitee_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'bound' check (status in ('bound', 'rewarded', 'invalid')),
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(invitee_user_id)
);

create index if not exists idx_invites_inviter on public.invites(inviter_user_id);

create table if not exists public.admin_entitlement_audit (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  before_tier text,
  before_end_at timestamptz,
  after_tier text not null,
  after_end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip text,
  device_hash text,
  event_type text not null,
  event_score integer not null default 1,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_risk_events_device on public.risk_events(device_hash, created_at desc);
create index if not exists idx_risk_events_ip on public.risk_events(ip, created_at desc);

-- ------------------------------------------------------------
-- Prompt Templates / Agentic workflow tables
-- ------------------------------------------------------------
create table if not exists public.prompt_templates (
  agent_key text primary key,
  display_name text not null,
  system_prompt text not null,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_prompt_templates_updated_at on public.prompt_templates;
create trigger trg_prompt_templates_updated_at
before update on public.prompt_templates
for each row execute function public.set_updated_at();

create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stock_input text not null,
  stock_code text,
  stock_name text,
  market text,
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  report_id uuid references public.reports(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  model_route jsonb not null default '{}'::jsonb,
  quota_snapshot jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_report_jobs_updated_at on public.report_jobs;
create trigger trg_report_jobs_updated_at
before update on public.report_jobs
for each row execute function public.set_updated_at();

create index if not exists idx_report_jobs_user_requested on public.report_jobs(user_id, requested_at desc);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  report_job_id uuid references public.report_jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('processing', 'completed', 'failed')),
  source_model text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_agent_runs_updated_at on public.agent_runs;
create trigger trg_agent_runs_updated_at
before update on public.agent_runs
for each row execute function public.set_updated_at();

create table if not exists public.agent_sections (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_key text not null,
  section_title text not null,
  section_order integer not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  input_payload jsonb not null default '{}'::jsonb,
  output_text text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_agent_sections_updated_at on public.agent_sections;
create trigger trg_agent_sections_updated_at
before update on public.agent_sections
for each row execute function public.set_updated_at();

create index if not exists idx_agent_sections_run_order on public.agent_sections(run_id, section_order);

-- ------------------------------------------------------------
-- Unified stock aliases + annual wide table for dynamic panel
-- ------------------------------------------------------------
create table if not exists public.stock_aliases (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('CN', 'HK', 'US')),
  canonical_code text not null,
  name text,
  short_name text,
  alias text,
  created_at timestamptz not null default now(),
  unique(market, canonical_code, coalesce(alias, ''), coalesce(short_name, ''), coalesce(name, ''))
);

create index if not exists idx_stock_aliases_alias on public.stock_aliases(alias);
create index if not exists idx_stock_aliases_name on public.stock_aliases(name);

create table if not exists public.financial_annual_data (
  id uuid primary key default gen_random_uuid(),
  ticker varchar(20) not null,
  fiscal_year int not null,
  revenue numeric(18, 4),
  net_income numeric(18, 4),
  ebit numeric(18, 4),
  operating_cash_flow numeric(18, 4),
  capex numeric(18, 4),
  free_cash_flow numeric(18, 4),
  net_margin numeric(12, 6),
  asset_turnover numeric(12, 6),
  equity_multiplier numeric(12, 6),
  roe numeric(12, 6),
  roic numeric(12, 6),
  wacc numeric(12, 6),
  market_cap numeric(18, 4),
  retained_earnings numeric(18, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ticker, fiscal_year)
);

drop trigger if exists trg_financial_annual_data_updated_at on public.financial_annual_data;
create trigger trg_financial_annual_data_updated_at
before update on public.financial_annual_data
for each row execute function public.set_updated_at();

create index if not exists idx_ticker_year on public.financial_annual_data(ticker, fiscal_year);

-- ------------------------------------------------------------
-- Business Functions
-- ------------------------------------------------------------
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id and role = 'admin'
  );
$$;

create or replace function public.resolve_user_tier(
  p_user_id uuid,
  p_now timestamptz default now()
)
returns table (
  tier text,
  expires_at timestamptz,
  limit_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_exp timestamptz;
begin
  update public.user_entitlements
  set status = 'expired'
  where user_id = p_user_id
    and status = 'active'
    and end_at <= p_now;

  select ue.tier, ue.end_at
  into v_tier, v_exp
  from public.user_entitlements ue
  where ue.user_id = p_user_id
    and ue.status = 'active'
    and ue.end_at > p_now
  order by
    case ue.tier when 'svip' then 3 when 'vip' then 2 else 1 end desc,
    ue.end_at desc
  limit 1;

  if v_tier is null then
    tier := 'free';
    expires_at := null;
    limit_count := 1;
    return next;
  end if;

  tier := v_tier;
  expires_at := v_exp;
  limit_count := case v_tier when 'svip' then 20 when 'vip' then 10 else 1 end;
  return next;
end;
$$;

create or replace function public.grant_entitlement(
  p_user_id uuid,
  p_tier text,
  p_days integer,
  p_source text,
  p_reference text default null
)
returns table (
  tier text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base timestamptz;
  v_new_end timestamptz;
  v_effective_tier text;
begin
  if p_days <= 0 then
    raise exception 'p_days must be positive';
  end if;

  if p_tier not in ('vip', 'svip', 'free') then
    raise exception 'unsupported tier: %', p_tier;
  end if;

  select r.tier into v_effective_tier
  from public.resolve_user_tier(p_user_id) r
  limit 1;

  if p_tier = 'svip' then
    -- 升级到 SVIP：立即生效；若已有 SVIP 则顺延。
    select coalesce(max(end_at), now())
    into v_base
    from public.user_entitlements
    where user_id = p_user_id
      and status = 'active'
      and tier = 'svip'
      and end_at > now();
  elsif p_tier = 'vip' and v_effective_tier = 'svip' then
    -- 当前是 SVIP，再买 VIP：顺延到高档权益之后，避免降级。
    select coalesce(max(end_at), now())
    into v_base
    from public.user_entitlements
    where user_id = p_user_id
      and status = 'active'
      and end_at > now();
  else
    -- 同档续费：顺延同档；无同档则立即生效。
    select coalesce(max(end_at), now())
    into v_base
    from public.user_entitlements
    where user_id = p_user_id
      and status = 'active'
      and tier = p_tier
      and end_at > now();
  end if;

  if v_base is null or v_base < now() then
    v_base := now();
  end if;

  v_new_end := v_base + make_interval(days => p_days);

  insert into public.user_entitlements (
    user_id, tier, start_at, end_at, source, reference, status
  ) values (
    p_user_id, p_tier, v_base, v_new_end, p_source, p_reference, 'active'
  );

  return query
    select r.tier, r.expires_at
    from public.resolve_user_tier(p_user_id) r;
end;
$$;

create or replace function public.consume_daily_quota(
  p_user_id uuid,
  p_usage_date date default ((now() at time zone 'asia/shanghai')::date)
)
returns table (
  allowed boolean,
  tier text,
  used_count integer,
  limit_count integer,
  remaining integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_limit integer;
  v_exp timestamptz;
  v_used integer;
begin
  select r.tier, r.limit_count, r.expires_at
  into v_tier, v_limit, v_exp
  from public.resolve_user_tier(p_user_id) r
  limit 1;

  insert into public.daily_usage (user_id, usage_date, used_count, limit_count)
  values (p_user_id, p_usage_date, 0, v_limit)
  on conflict (user_id, usage_date)
  do update set limit_count = excluded.limit_count
  returning daily_usage.used_count
  into v_used;

  if v_used >= v_limit then
    allowed := false;
    tier := v_tier;
    used_count := v_used;
    limit_count := v_limit;
    remaining := 0;
    expires_at := v_exp;
    return next;
    return;
  end if;

  update public.daily_usage
  set used_count = used_count + 1
  where user_id = p_user_id and usage_date = p_usage_date
  returning daily_usage.used_count
  into v_used;

  allowed := true;
  tier := v_tier;
  used_count := v_used;
  limit_count := v_limit;
  remaining := greatest(v_limit - v_used, 0);
  expires_at := v_exp;
  return next;
end;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.daily_usage enable row level security;
alter table public.orders enable row level security;
alter table public.invites enable row level security;
alter table public.admin_entitlement_audit enable row level security;
alter table public.risk_events enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.report_jobs enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_sections enable row level security;
alter table public.stock_aliases enable row level security;
alter table public.financial_annual_data enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
on public.profiles for select
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists entitlements_select_self on public.user_entitlements;
create policy entitlements_select_self
on public.user_entitlements for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists usage_select_self on public.daily_usage;
create policy usage_select_self
on public.daily_usage for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists orders_select_self on public.orders;
create policy orders_select_self
on public.orders for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists invites_select_related on public.invites;
create policy invites_select_related
on public.invites for select
using (auth.uid() = inviter_user_id or auth.uid() = invitee_user_id or public.is_admin(auth.uid()));

drop policy if exists report_jobs_select_self on public.report_jobs;
create policy report_jobs_select_self
on public.report_jobs for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists reports_select_all_auth on public.reports;
create policy reports_select_all_auth
on public.reports for select
using (auth.role() = 'authenticated');

drop policy if exists generation_tasks_select_all_auth on public.generation_tasks;
create policy generation_tasks_select_all_auth
on public.generation_tasks for select
using (auth.role() = 'authenticated');

drop policy if exists agent_runs_select_self on public.agent_runs;
create policy agent_runs_select_self
on public.agent_runs for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists agent_sections_select_via_run on public.agent_sections;
create policy agent_sections_select_via_run
on public.agent_sections for select
using (
  exists (
    select 1
    from public.agent_runs ar
    where ar.id = run_id
      and (ar.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists prompt_templates_select_auth on public.prompt_templates;
create policy prompt_templates_select_auth
on public.prompt_templates for select
using (auth.role() = 'authenticated');

drop policy if exists prompt_templates_update_admin on public.prompt_templates;
create policy prompt_templates_update_admin
on public.prompt_templates for update
using (public.is_admin(auth.uid()));

drop policy if exists stock_aliases_select_auth on public.stock_aliases;
create policy stock_aliases_select_auth
on public.stock_aliases for select
using (auth.role() = 'authenticated');

drop policy if exists financial_data_select_auth on public.financial_annual_data;
create policy financial_data_select_auth
on public.financial_annual_data for select
using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Prompt defaults (7 agents + chief editor)
-- ------------------------------------------------------------
insert into public.prompt_templates (agent_key, display_name, system_prompt, input_schema, output_schema)
values
(
  'alpha_hook',
  '投资要点 Agent',
  '你是顶级投行首席策略师。撰写【投资要点】。拒绝废话，不描述主营业务；核心是击碎市场共识并提炼认知差。输出：评级、目标价区间、预期差、3-6个月催化剂。',
  '{"required":["company_summary","core_news","consensus_eps_pe"]}'::jsonb,
  '{"required":["核心结论","预期差","核心催化剂"]}'::jsonb
),
(
  'fundamental_macro',
  '基本面 Agent',
  '你是宏观经济学家与法医级财务分析师。撰写【基本面】。必须结合宏观与十年财务证伪：ROIC vs WACC、杜邦驱动演变。',
  '{"required":["macro_indicators","financial_annual_data"]}'::jsonb,
  '{"required":["宏观水位映射","商业模式穿透","十年资本配置检验","杜邦因子剖析"]}'::jsonb
),
(
  'quant_pricing',
  '估值模型 Agent',
  '你是顶级量化估值专家。撰写【估值模型】。必须多情景：牛20%/基准60%/熊20%，并说明DCF假设与SOTP逻辑。',
  '{"required":["segment_financials","peer_multiples","risk_free_rate","beta"]}'::jsonb,
  '{"required":["SOTP","DCF核心假设","蒙特卡洛情景沙盘"]}'::jsonb
),
(
  'industry_comparison',
  '行业比较 Agent',
  '你是产业链研究员。撰写【行业比较】。关注利润池漂移、产能周期、生态位护城河，避免只做静态表格。',
  '{"required":["industry_margin_chain","top5_share_trend","industry_capex_growth"]}'::jsonb,
  '{"required":["利润池漂移","产能周期拐点","生态位对比"]}'::jsonb
),
(
  'news_altdata',
  '消息面 Agent',
  '你是另类数据驱动交易员。撰写【消息面】。用高频数据、情绪温度、事件日历，前瞻下一季度。',
  '{"required":["bid_data","ecommerce_gmv","social_nlp"]}'::jsonb,
  '{"required":["另类数据追踪","市场情绪温度计","关键事件日历"]}'::jsonb
),
(
  'risk_management',
  '风险 Agent',
  '你是首席风控官。撰写【风险】。像法医一样给出财务红旗与核心杀逻辑，拒绝套话。',
  '{"required":["financial_red_flags","customer_concentration","insider_sell"]}'::jsonb,
  '{"required":["财务红旗预警","核心杀逻辑"]}'::jsonb
),
(
  'execution_strategy',
  '结论 Agent',
  '你是资深操盘手。撰写【结论】。输出赔率、建仓策略、宏观对冲建议，具备执行指令性。',
  '{"required":["sections_1_to_6","price_gap"]}'::jsonb,
  '{"required":["风险收益比","建仓策略","宏观贝塔对冲建议"]}'::jsonb
),
(
  'chief_editor',
  '主编 Agent',
  '你是总编辑。统一七段内容风格、逻辑和术语，固定顺序：投资要点→基本面→估值模型→行业比较→消息面→风险→结论，并附免责声明。避免重复和冲突。',
  '{"required":["seven_sections_raw"]}'::jsonb,
  '{"required":["sections","disclaimer"]}'::jsonb
)
on conflict (agent_key) do nothing;
