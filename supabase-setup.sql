-- Run ONCE in Supabase SQL Editor in a NEW or suitably prepared project.
-- All work orders are visible to authenticated users; edits are restricted by role/assignment.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'technician' check (role in ('admin','technician')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'technician')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Reconcile users created before this SQL was run.
insert into public.profiles(id,full_name,role)
select id, coalesce(raw_user_meta_data ->> 'full_name',''), 'technician'
from auth.users on conflict (id) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  location text not null check (location in ('Yorktown','Central Building','Jamestown')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','in_progress','completed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_orders_assigned_idx on public.work_orders (assigned_to);
create index if not exists work_orders_location_idx on public.work_orders (location);

create or replace function public.can_work(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists(
    select 1 from public.work_orders where id = p_order_id and assigned_to = (select auth.uid())
  );
$$;

create table if not exists public.order_tasks (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.work_orders(id) on delete cascade,
 title text not null check (length(trim(title)) > 0),
 position integer not null default 0,
 completed boolean not null default false,
 completed_by uuid references public.profiles(id),
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists order_tasks_order_idx on public.order_tasks(order_id);
create table if not exists public.order_comments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.work_orders(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 body text not null check (length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists order_comments_order_idx on public.order_comments(order_id);
create table if not exists public.time_entries (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.work_orders(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 hours numeric(6,2) not null check (hours > 0 and hours <= 24),
 work_status text not null check (work_status in ('completed','not_completed')),
 notes text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists time_entries_order_idx on public.time_entries(order_id);

alter table public.profiles enable row level security;
alter table public.work_orders enable row level security;
alter table public.order_tasks enable row level security;
alter table public.order_comments enable row level security;
alter table public.time_entries enable row level security;

create policy "All users may read coworker names" on public.profiles for select to authenticated using (true);
-- No browser-based profile role updates. Promote admins only in SQL Editor.
create policy "Signed in people read orders" on public.work_orders for select to authenticated using (true);
create policy "Admins create orders" on public.work_orders for insert to authenticated with check (public.is_admin() and created_by = (select auth.uid()));
create policy "Admins edit orders" on public.work_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Signed in people read tasks" on public.order_tasks for select to authenticated using (true);
create policy "Admins create tasks" on public.order_tasks for insert to authenticated with check (public.is_admin());
create policy "Assigned technician checks tasks" on public.order_tasks for update to authenticated using (public.can_work(order_id)) with check (public.can_work(order_id));
create policy "Signed in people read comments" on public.order_comments for select to authenticated using (true);
create policy "Assigned technician leaves comments" on public.order_comments for insert to authenticated with check (user_id = (select auth.uid()) and public.can_work(order_id));
create policy "Signed in people read timesheets" on public.time_entries for select to authenticated using (true);
create policy "Assigned technician logs time" on public.time_entries for insert to authenticated with check (user_id = (select auth.uid()) and public.can_work(order_id));

-- A technician can change ONLY the status of an assigned work order using this RPC.
create or replace function public.set_work_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('open','in_progress','completed') then raise exception 'Invalid status'; end if;
  if not public.can_work(p_order_id) then raise exception 'You are not assigned to this work order'; end if;
  update public.work_orders
  set status = p_status,
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_at = now()
  where id = p_order_id;
  if not found then raise exception 'Work order not found'; end if;
end; $$;
revoke all on function public.set_work_order_status(uuid,text) from public,anon;
grant execute on function public.set_work_order_status(uuid,text) to authenticated;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.can_work(uuid) from public,anon;
grant execute on function public.can_work(uuid) to authenticated;

-- IMPORTANT: Additional hardening for task edits. Admins may edit task fields,
-- technicians may update only check-off columns. Column UPDATE grants restrict
-- all users, including admins, to these three fields (admins can still INSERT).
revoke update on public.order_tasks from authenticated;
grant update (completed, completed_by, completed_at) on public.order_tasks to authenticated;

-- IMPORTANT: First create your own account through the site, then execute
-- the following separately in the SQL Editor with your real email address:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'you@example.com');
