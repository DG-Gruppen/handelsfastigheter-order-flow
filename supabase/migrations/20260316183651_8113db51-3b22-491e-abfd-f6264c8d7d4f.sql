
-- Enable pg_trgm for fuzzy search
create extension if not exists pg_trgm;

-- Content index table for RAG search
create table public.content_index (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  title text not null default '',
  content text not null default '',
  metadata jsonb default '{}',
  fts tsvector generated always as (
    setweight(to_tsvector('swedish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('swedish', coalesce(content, '')), 'B')
  ) stored,
  updated_at timestamptz default now(),
  unique(source_table, source_id)
);

-- Indexes
create index content_index_fts_idx on public.content_index using gin(fts);
create index content_index_title_trgm_idx on public.content_index using gin(title gin_trgm_ops);

-- RLS
alter table public.content_index enable row level security;

create policy "Authenticated users can search content"
  on public.content_index for select
  to authenticated
  using (true);

create policy "Service role can manage content index"
  on public.content_index for all
  to service_role
  using (true)
  with check (true);

-- Search function with FTS + trigram hybrid
create or replace function public.search_content(
  query_text text,
  match_limit int default 5
)
returns table(
  id uuid,
  source_table text,
  source_id uuid,
  title text,
  content text,
  metadata jsonb,
  relevance real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tsquery_val tsquery;
begin
  tsquery_val := plainto_tsquery('swedish', query_text);

  return query
    select
      ci.id,
      ci.source_table,
      ci.source_id,
      ci.title,
      ci.content,
      ci.metadata,
      (ts_rank(ci.fts, tsquery_val) + similarity(ci.title, query_text))::real as relevance
    from public.content_index ci
    where ci.fts @@ tsquery_val
       or similarity(ci.title, query_text) > 0.15
    order by relevance desc
    limit match_limit;
end;
$$;

-- Trigger: auto-index kb_articles
create or replace function public.index_kb_article()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.content_index where source_table = 'kb_articles' and source_id = OLD.id;
    return OLD;
  end if;
  if NEW.is_published = true then
    insert into public.content_index (source_table, source_id, title, content, metadata, updated_at)
    values ('kb_articles', NEW.id, NEW.title, NEW.excerpt || E'\n' || NEW.content,
            jsonb_build_object('tags', NEW.tags, 'category_id', NEW.category_id), now())
    on conflict (source_table, source_id)
    do update set title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
  else
    delete from public.content_index where source_table = 'kb_articles' and source_id = NEW.id;
  end if;
  return NEW;
end;
$$;

create trigger trg_index_kb_article
  after insert or update or delete on public.kb_articles
  for each row execute function public.index_kb_article();

-- Trigger: auto-index it_faq
create or replace function public.index_it_faq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.content_index where source_table = 'it_faq' and source_id = OLD.id;
    return OLD;
  end if;
  if NEW.is_active = true then
    insert into public.content_index (source_table, source_id, title, content, metadata, updated_at)
    values ('it_faq', NEW.id, NEW.question, NEW.answer, '{}'::jsonb, now())
    on conflict (source_table, source_id)
    do update set title = excluded.title, content = excluded.content, updated_at = now();
  else
    delete from public.content_index where source_table = 'it_faq' and source_id = NEW.id;
  end if;
  return NEW;
end;
$$;

create trigger trg_index_it_faq
  after insert or update or delete on public.it_faq
  for each row execute function public.index_it_faq();

-- Trigger: auto-index kb_videos
create or replace function public.index_kb_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.content_index where source_table = 'kb_videos' and source_id = OLD.id;
    return OLD;
  end if;
  if NEW.is_published = true then
    insert into public.content_index (source_table, source_id, title, content, metadata, updated_at)
    values ('kb_videos', NEW.id, NEW.title, NEW.description,
            jsonb_build_object('tags', NEW.tags, 'video_url', NEW.video_url), now())
    on conflict (source_table, source_id)
    do update set title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
  else
    delete from public.content_index where source_table = 'kb_videos' and source_id = NEW.id;
  end if;
  return NEW;
end;
$$;

create trigger trg_index_kb_video
  after insert or update or delete on public.kb_videos
  for each row execute function public.index_kb_video();
