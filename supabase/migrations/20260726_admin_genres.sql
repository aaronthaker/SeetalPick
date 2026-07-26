-- Seetal Pick live upgrade: admin workspace + genre-aware sessions.
-- Safe to run once on an existing project. Existing items, swipes and sessions are preserved.

create extension if not exists pgcrypto;

alter table public.app_users add column if not exists is_admin boolean not null default false;
alter table public.pick_items add column if not exists genres text[] not null default array['Other'];
alter table public.category_sessions add column if not exists filter_key text not null default 'all';

update public.app_users set is_admin = true
where id = '11111111-1111-4111-8111-111111111111';

update public.app_users set is_admin = true
where id = (select id from public.app_users where active order by created_at asc limit 1)
  and not exists (select 1 from public.app_users where is_admin);

update public.pick_items set genres = case id
  when '10000000-0000-4000-8000-000000000001' then array['Italian']
  when '10000000-0000-4000-8000-000000000002' then array['Japanese']
  when '10000000-0000-4000-8000-000000000003' then array['British']
  when '10000000-0000-4000-8000-000000000004' then array['Mediterranean']
  when '20000000-0000-4000-8000-000000000001' then array['Pizza']
  when '20000000-0000-4000-8000-000000000002' then array['Thai']
  when '20000000-0000-4000-8000-000000000003' then array['Indian']
  when '20000000-0000-4000-8000-000000000004' then array['Mexican']
  when '30000000-0000-4000-8000-000000000001' then array['Comedy','Drama']
  when '30000000-0000-4000-8000-000000000002' then array['Mystery','Comedy']
  when '30000000-0000-4000-8000-000000000003' then array['Romance','Drama']
  when '30000000-0000-4000-8000-000000000004' then array['Mystery','Comedy']
  when '40000000-0000-4000-8000-000000000001' then array['Creative','Relaxed']
  when '40000000-0000-4000-8000-000000000002' then array['Outdoors','Relaxed','Food & drink']
  when '40000000-0000-4000-8000-000000000003' then array['Active','Games']
  when '40000000-0000-4000-8000-000000000004' then array['Outdoors','Day trip']
  else genres end
where source = 'starter';

update public.pick_items p
set genres = coalesce(
  (
    select array_agg(option)
    from unnest(
      case p.category_id
        when 'restaurants' then array['Italian','Japanese','Indian','Chinese','Thai','Mediterranean','Mexican','British']
        when 'takeaway' then array['Pizza','Indian','Chinese','Thai','Japanese','Burgers','Chicken','Mexican','Healthy','Desserts']
        when 'watch' then array['Comedy','Drama','Romance','Action','Thriller','Horror','Mystery','Sci-Fi','Fantasy','Documentary','Animation','Family']
        else array['Creative','Outdoors','Active','Games','Culture','Relaxed','Food & drink','Day trip','At home']
      end
    ) option
    where lower(concat_ws(' ', p.name, p.subtitle, array_to_string(p.tags, ' '))) like '%' || lower(option) || '%'
  ),
  array['Other']
)
where p.source <> 'starter' and p.genres = array['Other'];

alter table public.category_sessions
  drop constraint if exists category_sessions_user_id_category_id_session_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'category_sessions_user_category_day_filter_key'
      and conrelid = 'public.category_sessions'::regclass
  ) then
    alter table public.category_sessions
      add constraint category_sessions_user_category_day_filter_key
      unique (user_id, category_id, session_date, filter_key);
  end if;
end $$;

create table if not exists public.admin_sessions (
  token_hash bytea primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.admin_sessions enable row level security;

create or replace view public.app_user_profiles as
  select id, display_name, avatar_color, active, created_at, is_admin
  from public.app_users;
grant select on public.app_user_profiles to anon, authenticated;

revoke update, delete on public.pick_items from anon, authenticated;
drop policy if exists "shared items editable" on public.pick_items;

drop function if exists public.login_with_passphrase(text);
create function public.login_with_passphrase(provided_passphrase text)
returns table (id uuid, display_name text, avatar_color text, is_admin boolean, admin_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched public.app_users%rowtype;
  raw_token text;
begin
  delete from public.admin_sessions where expires_at <= now();
  select u.* into matched from public.app_users u
  where u.active = true and u.passphrase_hash = crypt(provided_passphrase, u.passphrase_hash)
  limit 1;
  if not found then return; end if;
  if matched.is_admin then
    raw_token := encode(gen_random_bytes(32), 'hex');
    insert into public.admin_sessions (token_hash, user_id, expires_at)
    values (digest(raw_token, 'sha256'), matched.id, now() + interval '12 hours');
  end if;
  return query select matched.id, matched.display_name, matched.avatar_color, matched.is_admin, raw_token;
end;
$$;
revoke all on function public.login_with_passphrase(text) from public;
grant execute on function public.login_with_passphrase(text) to anon, authenticated;

create or replace function public.is_valid_admin_token(p_admin_token text)
returns boolean language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_sessions s join public.app_users u on u.id = s.user_id
    where s.token_hash = digest(coalesce(p_admin_token, ''), 'sha256')
      and s.expires_at > now() and u.active and u.is_admin
  );
$$;

create or replace function public.admin_update_item(p_admin_token text, p_item_id uuid, p_item jsonb)
returns setof public.pick_items language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_valid_admin_token(p_admin_token) then raise exception 'Admin session expired'; end if;
  return query update public.pick_items i set
    category_id = coalesce(nullif(p_item->>'categoryId', ''), i.category_id),
    name = coalesce(nullif(trim(p_item->>'name'), ''), i.name),
    subtitle = coalesce(p_item->>'subtitle', i.subtitle),
    image_url = coalesce(nullif(p_item->>'imageUrl', ''), i.image_url),
    genres = case when jsonb_typeof(p_item->'genres') = 'array' then array(select jsonb_array_elements_text(p_item->'genres')) else i.genres end,
    tags = case when jsonb_typeof(p_item->'tags') = 'array' then array(select jsonb_array_elements_text(p_item->'tags')) else i.tags end,
    source = coalesce(nullif(p_item->>'source', ''), i.source),
    source_id = nullif(p_item->>'sourceId', ''), source_url = nullif(p_item->>'sourceUrl', '')
  where i.id = p_item_id returning i.*;
end;
$$;

create or replace function public.admin_set_item_active(p_admin_token text, p_item_id uuid, p_active boolean)
returns setof public.pick_items language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_valid_admin_token(p_admin_token) then raise exception 'Admin session expired'; end if;
  return query update public.pick_items i set active = p_active where i.id = p_item_id returning i.*;
end;
$$;

create or replace function public.admin_delete_item(p_admin_token text, p_item_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_valid_admin_token(p_admin_token) then raise exception 'Admin session expired'; end if;
  delete from public.pick_items where id = p_item_id;
end;
$$;

create or replace function public.admin_import_items(p_admin_token text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  entry jsonb; imported_count integer := 0; skipped_count integer := 0;
  category text; item_name text;
begin
  if not public.is_valid_admin_token(p_admin_token) then raise exception 'Admin session expired'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'JSON must be an array'; end if;
  if jsonb_array_length(p_items) > 500 then raise exception 'Import is limited to 500 items'; end if;
  for entry in select value from jsonb_array_elements(p_items)
  loop
    category := entry->>'categoryId'; item_name := trim(entry->>'name');
    if category not in ('restaurants', 'takeaway', 'watch', 'activities') or coalesce(item_name, '') = '' then
      raise exception 'Every item needs a valid categoryId and name';
    end if;
    if exists (select 1 from public.pick_items where category_id = category and lower(name) = lower(item_name)) then
      skipped_count := skipped_count + 1;
    else
      insert into public.pick_items (category_id, name, subtitle, image_url, genres, tags, source, source_id, source_url)
      values (
        category, item_name, coalesce(entry->>'subtitle', 'Added by JSON import'), nullif(entry->>'imageUrl', ''),
        case when jsonb_typeof(entry->'genres') = 'array' then array(select jsonb_array_elements_text(entry->'genres')) else array['Other'] end,
        case when jsonb_typeof(entry->'tags') = 'array' then array(select jsonb_array_elements_text(entry->'tags')) else '{}' end,
        coalesce(nullif(entry->>'source', ''), 'json-import'), nullif(entry->>'sourceId', ''), nullif(entry->>'sourceUrl', '')
      );
      imported_count := imported_count + 1;
    end if;
  end loop;
  return jsonb_build_object('imported', imported_count, 'skipped', skipped_count);
end;
$$;

revoke all on function public.is_valid_admin_token(text) from public;
revoke all on function public.admin_update_item(text, uuid, jsonb) from public;
revoke all on function public.admin_set_item_active(text, uuid, boolean) from public;
revoke all on function public.admin_delete_item(text, uuid) from public;
revoke all on function public.admin_import_items(text, jsonb) from public;
grant execute on function public.admin_update_item(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.admin_set_item_active(text, uuid, boolean) to anon, authenticated;
grant execute on function public.admin_delete_item(text, uuid) to anon, authenticated;
grant execute on function public.admin_import_items(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
