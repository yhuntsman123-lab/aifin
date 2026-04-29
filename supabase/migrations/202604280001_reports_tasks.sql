-- 报告主表：存储机构模板与衍生内容生成所需元数据
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  stock_code text not null,
  stock_name text not null,
  title text not null,
  html_url text,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reports is '机构级研报主数据，payload 保留 FinRobot 模板输出结构';

-- 任务表：适配 Vercel 短时函数 + Cloudflare 队列的异步生成模式
create table if not exists public.generation_tasks (
  id uuid primary key,
  report_id uuid not null references public.reports(id) on delete cascade,
  action text not null check (action in ('wechat', 'xiaohongshu', 'douyin', 'pdf')),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  output_url text,
  output_text text,
  output_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_generation_tasks_report_action
  on public.generation_tasks(report_id, action, created_at desc);

alter table public.reports enable row level security;
alter table public.generation_tasks enable row level security;

-- 注意：生产环境请按你的 Auth/RLS 策略补充 policy，这里只做结构初始化。

