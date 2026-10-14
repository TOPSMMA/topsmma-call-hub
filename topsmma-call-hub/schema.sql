-- TOPSMMA Call Hub, database schema (Postgres, built for Supabase)
-- Run this in the Supabase SQL editor once your project exists.
-- Supabase gives you auth.users for free, this schema hangs everything
-- off that so username and password logins and per rep permissions
-- come from the same place, not bolted on later.

-- ==========================================================
-- PROFILES  (one row per rep, including you, keyed to auth.users)
-- ==========================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'rep' check (role in ('admin', 'rep')),
  base_salary_monthly numeric(10, 2) default 0,
  commission_rate numeric(5, 4) default 0,          -- e.g. 0.10 = 10%
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- When you create a teammate's login in the Supabase dashboard
-- (Authentication > Users > Add user), this trigger automatically
-- creates their matching profiles row, defaulting to the 'rep' role,
-- so you never have to insert that row by hand.
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================
-- LEADS  (the pipeline and lead detail card)
-- ==========================================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  nextval_id bigint generated always as identity,
  lead_number text generated always as ('LEAD-' || lpad(nextval_id::text, 4, '0')) stored,
  company_name text not null,
  contact_name text,
  contact_role text,
  phone text,
  email text,
  website text,
  region text,                                       -- e.g. "Manchester, UK"
  tier text check (tier in ('T1', 'T2', 'T3')) default 'T3',
  tier_label text,                                    -- "Whale" / "Bread & Butter" / "Mass Market"
  score int default 0,
  source text,                                        -- "Cold call", "Referral", "Inbound", etc.
  status text not null default 'Uncalled'
    check (status in ('Uncalled', 'Contacted', 'Qualified', 'Meeting Booked',
                       'Proposal Sent', 'Closed Won', 'Closed Lost')),
  assigned_rep_id uuid references profiles (id),       -- null = sitting in the unassigned pool
  google_rating numeric(2, 1),
  google_reviews int,
  signals text,
  research_notes text,
  ai_brief text,
  next_followup_at timestamptz,
  last_activity_at timestamptz,
  last_called_at timestamptz,
  deal_value numeric(10, 2),
  close_date date,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_assigned_rep_idx on leads (assigned_rep_id);
create index leads_status_idx on leads (status);
create index leads_next_followup_idx on leads (next_followup_at);

-- ==========================================================
-- CALL_LOGS  (one row per call, feeds the cold call KPIs)
-- ==========================================================
create table call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  rep_id uuid not null references profiles (id),
  called_at timestamptz not null default now(),
  outcome text not null check (outcome in ('Connected', 'Voicemail', 'No Answer')),
  objection text,
  duration_seconds int,
  led_to_meeting boolean not null default false,
  notes text
);

create index call_logs_rep_date_idx on call_logs (rep_id, called_at);

-- ==========================================================
-- COSTS_EXPENSES  (the P&L ledger, admin entered)
-- ==========================================================
create table costs_expenses (
  id uuid primary key default gen_random_uuid(),
  month date not null,                                -- store as the 1st of the month
  rep_id uuid references profiles (id),                -- null = shared / company wide
  cost_type text not null
    check (cost_type in ('Software subscription', 'Lead list purchase', 'Ad spend',
                          'Platform fee', 'Other')),
  amount numeric(10, 2) not null,
  notes text
);

-- ==========================================================
-- REVENUE_CLOSED_WON  (one row per closed deal)
-- ==========================================================
create table revenue_closed_won (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id),
  rep_id uuid not null references profiles (id),
  close_date date not null default current_date,
  revenue_amount numeric(10, 2) not null,
  is_recurring boolean not null default false,
  contract_length_months int
);

-- ==========================================================
-- COMMISSION, calculated live, not typed in anywhere
-- ==========================================================
create view commission_payouts as
select
  date_trunc('month', r.close_date)::date as month,
  r.rep_id,
  p.full_name as rep_name,
  sum(r.revenue_amount) as closed_revenue_total,
  p.commission_rate,
  sum(r.revenue_amount) * p.commission_rate as commission_owed,
  p.base_salary_monthly as base_salary,
  (sum(r.revenue_amount) * p.commission_rate) + p.base_salary_monthly as total_comp
from revenue_closed_won r
join profiles p on p.id = r.rep_id
group by date_trunc('month', r.close_date), r.rep_id, p.full_name, p.commission_rate, p.base_salary_monthly;

-- ==========================================================
-- ROW LEVEL SECURITY
-- This is what makes "share a username and password" safe: a rep only
-- ever sees their own leads and calls, never the whole book or the P&L,
-- unless their profile role is 'admin' (set that manually for yourself
-- after your first login).
-- ==========================================================
alter table profiles enable row level security;
alter table leads enable row level security;
alter table call_logs enable row level security;
alter table costs_expenses enable row level security;
alter table revenue_closed_won enable row level security;

create function is_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer;

-- profiles: everyone can read their own row and the team roster, only admins edit others
create policy "read own or any profile" on profiles for select using (true);
create policy "update own profile" on profiles for update using (id = auth.uid() or is_admin());

-- leads: a rep sees their own assigned leads plus the unassigned pool, read only on the pool
create policy "read assigned or pool leads" on leads for select
  using (assigned_rep_id = auth.uid() or assigned_rep_id is null or is_admin());
create policy "update own assigned leads" on leads for update
  using (assigned_rep_id = auth.uid() or is_admin());
create policy "admin manages leads" on leads for insert with check (is_admin());
create policy "admin deletes leads" on leads for delete using (is_admin());

-- call_logs: a rep logs and reads their own calls, admin sees all
create policy "read own call logs" on call_logs for select using (rep_id = auth.uid() or is_admin());
create policy "insert own call logs" on call_logs for insert with check (rep_id = auth.uid() or is_admin());

-- costs, revenue: admin only, this is the P&L, reps do not see company financials by default
create policy "admin reads costs" on costs_expenses for all using (is_admin());
create policy "admin reads revenue" on revenue_closed_won for select using (is_admin());
create policy "rep logs own closed deals" on revenue_closed_won for insert
  with check (rep_id = auth.uid() or is_admin());

-- ==========================================================
-- Notes on assumptions, change these if they don't fit:
-- 1. Reps can see the unassigned pool but not claim leads themselves,
--    only an admin (you) assigns them, matching the "Return uncalled"
--    control in Team & pool.
-- 2. Reps cannot see Costs_Expenses or Revenue_ClosedWon directly,
--    only their own call logs and their own assigned leads. P&L stays
--    admin only. Tell me if you want reps to see their own revenue
--    and commission, that is one policy change.
-- 3. The first person who signs up will not automatically be admin,
--    you need to run one update statement after your first login:
--    update profiles set role = 'admin' where email = 'you@yourdomain.com';
-- ==========================================================

-- ==========================================================
-- MIGRATION: team-wide Reports page (day/week/month tracking)
-- Run this once in the Supabase SQL editor to apply it to your
-- existing project. Before this runs, only an admin can see
-- everyone's call activity and revenue; after it runs, every
-- logged-in rep can see the whole team's numbers on /reports
-- (call logs) and revenue/closed deals, not just their own.
-- ==========================================================
drop policy "read own call logs" on call_logs;
create policy "read all call logs" on call_logs for select using (true);

drop policy "admin reads revenue" on revenue_closed_won;
create policy "read all revenue" on revenue_closed_won for select using (true);
-- ==========================================================

-- ==========================================================
-- MIGRATION: AI prospect briefs (general info, pain points, script)
-- Run this once in the Supabase SQL editor. ai_brief already existed
-- and is reused for the general-info summary; these are the new
-- columns the AI brief feature writes pain points and a suggested
-- call-opening script into, plus a status flag so the UI knows
-- whether a brief is still being generated.
--
-- No RLS policy changes are needed: reps already read these columns
-- through "read assigned or pool leads", and the feature's writes go
-- through the server using the service role key (see the app's
-- SUPABASE_SERVICE_ROLE_KEY environment variable), not through a
-- rep's own session.
-- ==========================================================
alter table leads add column if not exists ai_brief_status text not null default 'none'
  check (ai_brief_status in ('none', 'pending', 'ready', 'failed'));
alter table leads add column if not exists ai_pain_points text;
alter table leads add column if not exists ai_call_script text;
alter table leads add column if not exists ai_brief_generated_at timestamptz;
-- ==========================================================


-- ==========================================================
-- MIGRATION: Tasks (to-dos and follow-ups)
-- Run this once in the Supabase SQL editor before using the Tasks
-- page. A task is deliberately separate from a lead's next_followup_at
-- field: next_followup_at is a single "when to call this lead again"
-- date baked into the lead itself, while a task has its own title, an
-- optional due date, and can optionally be tied to a lead or stand on
-- its own (a reminder, an admin chore, anything not call-specific).
-- ==========================================================
create table tasks (
    id uuid primary key default gen_random_uuid(),
    rep_id uuid not null references profiles (id),
    lead_id uuid references leads (id) on delete set null,
    title text not null,
    notes text,
    due_at timestamptz,
    completed boolean not null default false,
    completed_at timestamptz,
    created_at timestamptz not null default now()
  );

create index tasks_rep_due_idx on tasks (rep_id, due_at);

alter table tasks enable row level security;

-- A rep manages only their own tasks, admin sees and manages all of them.
create policy "read own tasks" on tasks for select using (rep_id = auth.uid() or is_admin());
create policy "insert own tasks" on tasks for insert with check (rep_id = auth.uid() or is_admin());
create policy "update own tasks" on tasks for update using (rep_id = auth.uid() or is_admin());
create policy "delete own tasks" on tasks for delete using (rep_id = auth.uid() or is_admin());
-- ==========================================================
