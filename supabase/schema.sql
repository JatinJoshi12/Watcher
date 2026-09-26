-- Watchlist Maker: multi-watchlist production schema
-- Run this in Supabase SQL Editor for a fresh project.
-- If you already ran the old single-watchlist schema, this file migrates it into "My Watchlist".

create extension if not exists pgcrypto;

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists watchlists_user_id_idx on public.watchlists(user_id);
create index if not exists watchlists_created_at_idx on public.watchlists(created_at desc);

-- Give existing accounts the same default list that new accounts receive.
insert into public.watchlists (user_id, name, description)
select id, 'My Watchlist', 'Your main collection.'
from auth.users
on conflict (user_id, name) do nothing;

create or replace function public.set_watchlist_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists watchlists_set_updated_at on public.watchlists;
create trigger watchlists_set_updated_at
before update on public.watchlists
for each row execute function public.set_watchlist_updated_at();

-- Existing versions already have this table. Add the new catalog/list fields in place.
create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_id uuid,
  tmdb_id bigint,
  type text not null check (type in ('movie', 'series')),
  title text not null check (length(btrim(title)) > 0),
  year smallint check (year is null or (year >= 1888 and year <= 2100)),
  genre text[] not null default '{}',
  poster_url text,
  poster_path text,
  backdrop_path text,
  description text,
  notes text,
  status text not null default 'unwatched' check (status in ('watched', 'unwatched')),
  rating numeric(2,1) check (rating is null or (rating >= 1 and rating <= 5)),
  platform text,
  language text,
  favorite boolean not null default false,
  progress numeric(5,2) default 0 check (progress is null or (progress >= 0 and progress <= 100)),
  current_season integer check (current_season is null or current_season >= 0),
  current_episode integer check (current_episode is null or current_episode >= 0),
  total_seasons integer check (total_seasons is null or total_seasons >= 0),
  total_episodes integer check (total_episodes is null or total_episodes >= 0),
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watchlist_items add column if not exists watchlist_id uuid;
alter table public.watchlist_items add column if not exists tmdb_id bigint;
alter table public.watchlist_items add column if not exists poster_path text;
alter table public.watchlist_items add column if not exists backdrop_path text;

-- Backfill existing users/items into one default list.
insert into public.watchlists (user_id, name, description)
select distinct user_id, 'My Watchlist', 'Your main collection.'
from public.watchlist_items
where user_id is not null
on conflict (user_id, name) do nothing;

update public.watchlist_items i
set watchlist_id = w.id
from public.watchlists w
where i.watchlist_id is null
  and w.user_id = i.user_id
  and w.name = 'My Watchlist';

alter table public.watchlist_items drop constraint if exists watchlist_items_watchlist_id_fkey;
alter table public.watchlist_items
  add constraint watchlist_items_watchlist_id_fkey
  foreign key (watchlist_id) references public.watchlists(id) on delete cascade;

-- Old rows are expected to have been backfilled above. New rows must always choose a list.
alter table public.watchlist_items alter column watchlist_id set not null;

create unique index if not exists watchlist_items_tmdb_unique_idx
on public.watchlist_items(watchlist_id, tmdb_id, type)
where tmdb_id is not null;

create index if not exists watchlist_items_user_id_idx on public.watchlist_items(user_id);
create index if not exists watchlist_items_watchlist_id_idx on public.watchlist_items(watchlist_id);
create index if not exists watchlist_items_created_at_idx on public.watchlist_items(created_at desc);
create index if not exists watchlist_items_type_idx on public.watchlist_items(type);
create index if not exists watchlist_items_status_idx on public.watchlist_items(status);
create index if not exists watchlist_items_favorite_idx on public.watchlist_items(favorite);
create index if not exists watchlist_items_tmdb_id_idx on public.watchlist_items(tmdb_id);

drop trigger if exists watchlist_items_set_updated_at on public.watchlist_items;
create trigger watchlist_items_set_updated_at
before update on public.watchlist_items
for each row execute function public.set_watchlist_updated_at();

-- Automatically create a private default list for every new account.
create or replace function public.handle_new_user_watchlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.watchlists(user_id, name, description)
  values (new.id, 'My Watchlist', 'Your main collection.')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_watchlist on auth.users;
create trigger on_auth_user_created_watchlist
after insert on auth.users
for each row execute function public.handle_new_user_watchlist();

alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;

revoke all on table public.watchlists from anon;
revoke all on table public.watchlist_items from anon;
grant select, insert, update, delete on table public.watchlists to authenticated;
grant select, insert, update, delete on table public.watchlist_items to authenticated;

drop policy if exists "Users can view their own watchlists" on public.watchlists;
create policy "Users can view their own watchlists"
on public.watchlists for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own watchlists" on public.watchlists;
create policy "Users can create their own watchlists"
on public.watchlists for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own watchlists" on public.watchlists;
create policy "Users can update their own watchlists"
on public.watchlists for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own watchlists" on public.watchlists;
create policy "Users can delete their own watchlists"
on public.watchlists for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own watchlist items" on public.watchlist_items;
create policy "Users can view their own watchlist items"
on public.watchlist_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own watchlist items" on public.watchlist_items;
create policy "Users can insert their own watchlist items"
on public.watchlist_items for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their own watchlist items" on public.watchlist_items;
create policy "Users can update their own watchlist items"
on public.watchlist_items for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their own watchlist items" on public.watchlist_items;
create policy "Users can delete their own watchlist items"
on public.watchlist_items for delete to authenticated
using ((select auth.uid()) = user_id);

-- =========================================================
-- Watcher community + statistics extension
-- Existing watchlists remain untouched. These additions support
-- public profiles, cached runtime metadata, and
-- a secure public statistics RPC.
-- =========================================================

alter table public.watchlist_items add column if not exists runtime_minutes integer check (runtime_minutes is null or runtime_minutes >= 0);
alter table public.watchlist_items add column if not exists episode_runtime_minutes integer check (episode_runtime_minutes is null or episode_runtime_minutes >= 0);

create index if not exists watchlist_items_watched_at_idx on public.watchlist_items(watched_at desc);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (
    length(username) between 3 and 24
    and username ~ '^[a-zA-Z0-9_]+$'
  ),
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on public.profiles(lower(username));
create index if not exists profiles_display_name_lower_idx on public.profiles(lower(display_name));


-- Populate profiles for existing accounts. Usernames receive a stable suffix
-- so two accounts can safely share an email prefix.
do $$
declare
  u record;
  base text;
  candidate text;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    if not exists (select 1 from public.profiles p where p.user_id = u.id) then
      base := lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_]+', '_', 'g'));
      base := trim(both '_' from base);
      if length(base) < 3 then base := 'watcher'; end if;
      base := left(base, 24);
      candidate := left(base, 16) || '_' || substr(replace(u.id::text, '-', ''), 1, 7);
      insert into public.profiles(user_id, username, display_name, avatar_url)
      values (
        u.id,
        candidate,
        coalesce(u.raw_user_meta_data->>'display_name', ''),
        coalesce(u.raw_user_meta_data->>'avatar_url', '')
      )
      on conflict (user_id) do nothing;
    end if;
  end loop;
end $$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]+', '_', 'g'));
  base := trim(both '_' from base);
  if length(base) < 3 then base := 'watcher'; end if;
  base := left(base, 24);
  candidate := base;

  if exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) then
    raise exception 'That Username Is Already Taken.' using errcode = '23505';
  end if;

  insert into public.profiles(user_id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;

-- Return only public viewing statistics. The function is security definer so
-- callers never receive another user's raw watchlist rows.
create or replace function public.get_public_profile_stats(target_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
with watched as (
  select distinct on (
    case when tmdb_id is not null then tmdb_id::text else 'row:' || id::text end,
    type
  )
    id, tmdb_id, type, title, genre, rating, year, runtime_minutes,
    episode_runtime_minutes, total_episodes, watched_at, updated_at, created_at
  from public.watchlist_items
  where user_id = target_user_id
    and status = 'watched'
  order by
    case when tmdb_id is not null then tmdb_id::text else 'row:' || id::text end,
    type,
    watched_at desc nulls last,
    updated_at desc,
    created_at desc
),
movie_genres as (
  select unnest(genre) as genre from watched where type = 'movie'
),
series_genres as (
  select unnest(genre) as genre from watched where type = 'series'
),
movie_fav as (
  select genre, count(*) as count from movie_genres where nullif(btrim(genre), '') is not null group by genre order by count desc, genre limit 1
),
series_fav as (
  select genre, count(*) as count from series_genres where nullif(btrim(genre), '') is not null group by genre order by count desc, genre limit 1
),
movie_top as (
  select title, rating from watched where type = 'movie' and rating is not null order by rating desc, watched_at desc nulls last limit 1
),
series_top as (
  select title, rating from watched where type = 'series' and rating is not null order by rating desc, watched_at desc nulls last limit 1
)
select jsonb_build_object(
  'total_movies_watched', (select count(*) from watched where type = 'movie'),
  'total_series_watched', (select count(*) from watched where type = 'series'),
  'total_titles_watched', (select count(*) from watched),
  'favourite_movie_genre', coalesce((select genre from movie_fav), 'Not Enough Data'),
  'favourite_series_genre', coalesce((select genre from series_fav), 'Not Enough Data'),
  'total_movie_watch_time_minutes', coalesce((select sum(coalesce(runtime_minutes, 0)) from watched where type = 'movie'), 0),
  'total_series_watch_time_minutes', coalesce((select sum(coalesce(episode_runtime_minutes, 0) * coalesce(total_episodes, 0)) from watched where type = 'series'), 0),
  'average_rating', (select round(avg(rating), 2) from watched where rating is not null),
  'highest_rated_movie', case when exists(select 1 from movie_top) then jsonb_build_object('title', (select title from movie_top), 'rating', (select rating from movie_top)) else null end,
  'highest_rated_series', case when exists(select 1 from series_top) then jsonb_build_object('title', (select title from series_top), 'rating', (select rating from series_top)) else null end
);
$$;

revoke all on function public.get_public_profile_stats(uuid) from public;
grant execute on function public.get_public_profile_stats(uuid) to authenticated;


-- Review system removed by product decision. Existing review data/table is removed by this migration.
drop table if exists public.reviews cascade;
