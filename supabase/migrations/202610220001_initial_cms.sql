-- Coffeella CMS foundation
-- Run this file in the Supabase SQL Editor or through Supabase CLI migrations.
-- Never put a Supabase service_role key in browser code.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.site_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','admin','editor','analyst')),
  status text not null default 'active' check (status in ('active','blocked','invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists site_members_one_active_owner
  on public.site_members (role) where role = 'owner' and status = 'active';

create or replace function public.has_site_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_members m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.is_site_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_members m
    where m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_auth_profile();

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, settings)
values (true, '{
  "theme": {
    "mode": "dark",
    "colors": {
      "bg": "#120d0a",
      "bg-2": "#18110e",
      "surface": "#211814",
      "text": "#f4ebdf",
      "muted": "#bcad9d",
      "faint": "#8d7d6e",
      "accent": "#d69a5c",
      "accent-2": "#efc28f",
      "accent-ink": "#1b120c"
    },
    "fonts": {
      "arabic": "IBM Plex Sans Arabic",
      "display": "Reem Kufi",
      "english": "Lato"
    }
  },
  "features": { "themeSwitcher": false, "pageTransitions": "none" }
}'::jsonb)
on conflict (id) do nothing;

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null default '',
  short_name text,
  photo_url text,
  focus text default 'center',
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  legacy_key text unique,
  name_ar text not null,
  name_en text not null default '',
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_groups(id) on delete cascade,
  legacy_key text unique,
  name_ar text not null,
  name_en text not null default '',
  description text,
  price numeric(12,2),
  price_min numeric(12,2),
  price_max numeric(12,2),
  discount_price numeric(12,2),
  discount_percent numeric(5,2),
  image_url text,
  icon text,
  position integer not null default 0,
  is_available boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price is null or price >= 0),
  check (price_min is null or price_min >= 0),
  check (price_max is null or price_max >= 0),
  check (discount_price is null or discount_price >= 0),
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  check (price_min is null or price_max is null or price_min <= price_max)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  page_type text not null default 'custom' check (page_type in ('home','menu','custom','product')),
  layout jsonb not null default '{"version":1,"blocks":[]}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  transition text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.upload_rules (
  field_key text primary key,
  allowed_mime_types text[] not null default array['image/jpeg','image/png','image/webp'],
  max_bytes bigint not null default 5242880 check (max_bytes > 0 and max_bytes <= 52428800),
  updated_at timestamptz not null default now()
);

insert into public.upload_rules (field_key, allowed_mime_types, max_bytes) values
  ('site-image', array['image/jpeg','image/png','image/webp','image/avif'], 10485760),
  ('product-image', array['image/jpeg','image/png','image/webp','image/avif'], 10485760),
  ('document', array['application/pdf'], 10485760)
on conflict (field_key) do nothing;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view','page_leave','section_view','section_leave','button_click')),
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  page_path text not null default '/' check (length(page_path) <= 500),
  element_key text check (element_key is null or length(element_key) <= 160),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_page_idx on public.analytics_events (page_path, created_at desc);
create index if not exists menu_items_group_position_idx on public.menu_items (group_id, position);
create index if not exists menu_groups_category_position_idx on public.menu_groups (category_id, position);
create index if not exists pages_status_updated_idx on public.pages (status, updated_at desc);

alter table public.site_members enable row level security;
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_groups enable row level security;
alter table public.menu_items enable row level security;
alter table public.pages enable row level security;
alter table public.upload_rules enable row level security;
alter table public.analytics_events enable row level security;

-- Profiles and administrative membership details
drop policy if exists "members read own membership" on public.site_members;
create policy "members read own membership" on public.site_members
  for select to authenticated using (user_id = auth.uid() or public.has_site_role(array['owner','admin']));
drop policy if exists "owners manage memberships" on public.site_members;
create policy "owners manage memberships" on public.site_members
  for all to authenticated using (public.has_site_role(array['owner'])) with check (public.has_site_role(array['owner']));

drop policy if exists "read own profile or administrators read profiles" on public.profiles;
create policy "read own profile or administrators read profiles" on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.has_site_role(array['owner','admin']));
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public visitors can read settings, but only active content is exposed.
drop policy if exists "settings are publicly readable" on public.site_settings;
create policy "settings are publicly readable" on public.site_settings
  for select to anon, authenticated using (true);
drop policy if exists "edit settings by authorized members" on public.site_settings;
create policy "edit settings by authorized members" on public.site_settings
  for update to authenticated using (public.has_site_role(array['owner','admin','editor']))
  with check (public.has_site_role(array['owner','admin','editor']));

drop policy if exists "read published categories" on public.menu_categories;
create policy "read published categories" on public.menu_categories
  for select to anon, authenticated using (is_published or public.has_site_role(array['owner','admin','editor']));
drop policy if exists "manage categories" on public.menu_categories;
create policy "manage categories" on public.menu_categories
  for all to authenticated using (public.has_site_role(array['owner','admin','editor']))
  with check (public.has_site_role(array['owner','admin','editor']));

drop policy if exists "read published groups" on public.menu_groups;
create policy "read published groups" on public.menu_groups
  for select to anon, authenticated using (
    (is_published and exists (
      select 1 from public.menu_categories c where c.id = category_id and c.is_published
    )) or public.has_site_role(array['owner','admin','editor'])
  );
drop policy if exists "manage groups" on public.menu_groups;
create policy "manage groups" on public.menu_groups
  for all to authenticated using (public.has_site_role(array['owner','admin','editor']))
  with check (public.has_site_role(array['owner','admin','editor']));

drop policy if exists "read published items" on public.menu_items;
create policy "read published items" on public.menu_items
  for select to anon, authenticated using (
    (is_published and exists (
      select 1 from public.menu_groups g
      join public.menu_categories c on c.id = g.category_id
      where g.id = group_id and g.is_published and c.is_published
    )) or public.has_site_role(array['owner','admin','editor'])
  );
drop policy if exists "manage items" on public.menu_items;
create policy "manage items" on public.menu_items
  for all to authenticated using (public.has_site_role(array['owner','admin','editor']))
  with check (public.has_site_role(array['owner','admin','editor']));

drop policy if exists "read published pages" on public.pages;
create policy "read published pages" on public.pages
  for select to anon, authenticated using (status = 'published' or public.has_site_role(array['owner','admin','editor']));
drop policy if exists "manage pages" on public.pages;
create policy "manage pages" on public.pages
  for all to authenticated using (public.has_site_role(array['owner','admin','editor']))
  with check (public.has_site_role(array['owner','admin','editor']));

drop policy if exists "read upload rules" on public.upload_rules;
create policy "read upload rules" on public.upload_rules
  for select to anon, authenticated using (true);
drop policy if exists "manage upload rules" on public.upload_rules;
create policy "manage upload rules" on public.upload_rules
  for all to authenticated using (public.has_site_role(array['owner','admin']))
  with check (public.has_site_role(array['owner','admin']));

-- Analytics can be written by visitors, but only active staff can read it.
drop policy if exists "write minimal analytics events" on public.analytics_events;
create policy "write minimal analytics events" on public.analytics_events
  for insert to anon, authenticated with check (
    event_type in ('page_view','page_leave','section_view','section_leave','button_click')
    and session_id is not null
    and (user_id is null or user_id = auth.uid())
  );
drop policy if exists "read analytics for authorized staff" on public.analytics_events;
create policy "read analytics for authorized staff" on public.analytics_events
  for select to authenticated using (public.has_site_role(array['owner','admin','analyst']));

-- Update timestamps on mutable tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['site_members','profiles','menu_categories','menu_groups','menu_items','pages','upload_rules'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Public media can be viewed by visitors; uploading/deleting requires an editor or administrator.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/avif','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read site media" on storage.objects;
create policy "public can read site media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'site-media');
drop policy if exists "members upload site media" on storage.objects;
create policy "members upload site media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'site-media' and public.has_site_role(array['owner','admin','editor'])
  );
drop policy if exists "members update site media" on storage.objects;
create policy "members update site media" on storage.objects
  for update to authenticated using (
    bucket_id = 'site-media' and public.has_site_role(array['owner','admin','editor'])
  ) with check (
    bucket_id = 'site-media' and public.has_site_role(array['owner','admin','editor'])
  );
drop policy if exists "members delete site media" on storage.objects;
create policy "members delete site media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'site-media' and public.has_site_role(array['owner','admin','editor'])
  );

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.menu_categories, public.menu_groups, public.menu_items, public.pages, public.upload_rules to anon, authenticated;
grant select, insert, update, delete on public.site_members, public.profiles, public.site_settings,
  public.menu_categories, public.menu_groups, public.menu_items, public.pages, public.upload_rules,
  public.analytics_events to authenticated;
grant insert on public.analytics_events to anon;
grant usage, select on sequence public.analytics_events_id_seq to anon, authenticated;
