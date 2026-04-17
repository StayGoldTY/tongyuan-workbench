create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.bots (
  bot text primary key,
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.bots (bot, display_name, description)
values ('tongyuan', '童园', 'Work knowledge assistant')
on conflict (bot) do nothing;

create table if not exists public.source_catalog (
  source_key text primary key,
  source_family text not null,
  source_app text not null,
  workspace text not null,
  root_path text not null,
  adapter_key text not null,
  health text not null,
  notes text not null default '',
  last_discovered_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'collector',
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.source_sync_statuses (
  source_key text primary key references public.source_catalog(source_key) on delete cascade,
  workspace text not null,
  source_app text not null,
  status text not null,
  discovered_units integer not null default 0,
  uploaded_units integer not null default 0,
  message text not null,
  last_run_id uuid references public.ingestion_runs(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_units (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  bot text not null references public.bots(bot),
  source_family text not null,
  source_app text not null,
  workspace text not null,
  conversation_id text,
  speaker text,
  title text not null,
  content_redacted text not null,
  summary text not null,
  tags text[] not null default '{}',
  event_time timestamptz,
  permissions text[] not null default '{owner_only,redacted}',
  allowed_emails text[] not null default '{}',
  attachment_refs jsonb not null default '[]'::jsonb,
  checksum text not null,
  source_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_unit_id uuid not null references public.knowledge_units(id) on delete cascade,
  chunk_index integer not null,
  content_redacted text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  search_text tsvector generated always as (
    to_tsvector('simple', coalesce(content_redacted, '') || ' ' || coalesce(summary, ''))
  ) stored,
  created_at timestamptz not null default now(),
  unique (knowledge_unit_id, chunk_index)
);

create index if not exists knowledge_units_allowed_emails_idx on public.knowledge_units using gin (allowed_emails);
create index if not exists knowledge_chunks_search_idx on public.knowledge_chunks using gin (search_text);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.source_catalog enable row level security;
alter table public.source_sync_statuses enable row level security;
alter table public.knowledge_units enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy "authenticated_read_source_catalog"
on public.source_catalog
for select
to authenticated
using (true);

create policy "authenticated_read_sync_statuses"
on public.source_sync_statuses
for select
to authenticated
using (true);

create policy "allowlisted_read_knowledge_units"
on public.knowledge_units
for select
to authenticated
using (coalesce(auth.jwt()->>'email', '') = any(allowed_emails));

create policy "allowlisted_read_knowledge_chunks"
on public.knowledge_chunks
for select
to authenticated
using (
  exists (
    select 1
    from public.knowledge_units ku
    where ku.id = knowledge_chunks.knowledge_unit_id
      and coalesce(auth.jwt()->>'email', '') = any(ku.allowed_emails)
  )
);

create or replace function public.match_knowledge_chunks(
  search_query text,
  query_embedding vector(1536),
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  external_id text,
  title text,
  source_app text,
  workspace text,
  excerpt text,
  summary text,
  source_uri text,
  event_time timestamptz,
  tags text[],
  confidence double precision
)
language sql
security invoker
set search_path = public
as $$
  with ranked as (
    select
      kc.id as chunk_id,
      ku.external_id,
      ku.title,
      ku.source_app,
      ku.workspace,
      left(kc.content_redacted, 500) as excerpt,
      kc.summary,
      ku.source_uri,
      ku.event_time,
      ku.tags,
      case
        when query_embedding is null or kc.embedding is null then
          ts_rank(kc.search_text, plainto_tsquery('simple', coalesce(search_query, '')))
        else
          greatest(
            1 - (kc.embedding <=> query_embedding),
            ts_rank(kc.search_text, plainto_tsquery('simple', coalesce(search_query, '')))
          )
      end as confidence
    from public.knowledge_chunks kc
    join public.knowledge_units ku on ku.id = kc.knowledge_unit_id
    where coalesce(auth.jwt()->>'email', '') = any(ku.allowed_emails)
  )
  select *
  from ranked
  order by confidence desc, event_time desc nulls last
  limit match_count;
$$;
