-- AS Financial Services: admin/CRM schema + RLS
-- Run in Supabase SQL editor / migrations. Review before production.

create extension if not exists pgcrypto;

-- Helper: active admin check (security definer kept minimal; reads only admin_profiles)
create or replace function public.is_active_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.id = uid and p.is_active = true
  );
$$;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'admin' check (role in ('admin','manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text not null,
  loan_category text not null,
  requested_amount numeric(14,2),
  employment_type text,
  city_location text,
  message text,
  source_page text,
  status text not null default 'New' check (status in ('New','Contacted','Interested','Documents Pending','Under Review','Approved','Rejected','Closed')),
  admin_notes text,
  follow_up_date date,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customer_enquiries_submitted_at on public.customer_enquiries (submitted_at desc);
create index if not exists idx_customer_enquiries_status on public.customer_enquiries (status);
create index if not exists idx_customer_enquiries_loan on public.customer_enquiries (loan_category);
create index if not exists idx_customer_enquiries_phone on public.customer_enquiries (phone);

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.customer_enquiries(id) on delete set null,
  application_ref text unique,
  customer_name text not null,
  phone text,
  email text,
  loan_category text not null,
  requested_amount numeric(14,2),
  status text not null default 'New' check (status in ('New','Contacted','Interested','Documents Pending','Under Review','Approved','Rejected','Closed')),
  assigned_admin uuid references public.admin_profiles(id) on delete set null,
  notes text,
  follow_up_date date,
  application_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_loan_applications_date on public.loan_applications (application_date desc);

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  logo_url text,
  interest_rate_text text,
  min_loan_amount numeric(14,2),
  max_loan_amount numeric(14,2),
  processing_fee text,
  min_tenure text,
  max_tenure text,
  emi_per_lakh text,
  description text,
  website_url text,
  last_updated date,
  display_status boolean not null default true,
  display_order int not null default 100,
  illustrative boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_banks_display on public.banks (display_status, display_order);

create table if not exists public.interest_rates (
  id uuid primary key default gen_random_uuid(),
  lender_name text not null,
  loan_category text,
  min_rate numeric(6,3),
  max_rate numeric(6,3),
  processing_fee text,
  min_loan_amount numeric(14,2),
  max_loan_amount numeric(14,2),
  min_tenure text,
  max_tenure text,
  active boolean not null default true,
  description text,
  last_updated date,
  illustrative boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references public.admin_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.website_analytics (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  page_path text,
  referrer text,
  visitor_key text, -- privacy-conscious random/session key generated client-side; not PII
  event_date date not null default (now() at time zone 'utc')::date,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_event_type check (event_type in ('page_view','unique_visit','cta_click','contact_click','whatsapp_click','phone_click','calculator_interaction','enquiry_submit'))
);
create index if not exists idx_analytics_date on public.website_analytics (event_date desc);
create index if not exists idx_analytics_event on public.website_analytics (event_type, event_date);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_logs_created on public.admin_activity_logs (created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_admin_profiles_updated') then
    create trigger trg_admin_profiles_updated before update on public.admin_profiles for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_customer_enquiries_updated') then
    create trigger trg_customer_enquiries_updated before update on public.customer_enquiries for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_loan_applications_updated') then
    create trigger trg_loan_applications_updated before update on public.loan_applications for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_banks_updated') then
    create trigger trg_banks_updated before update on public.banks for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_interest_rates_updated') then
    create trigger trg_interest_rates_updated before update on public.interest_rates for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS
alter table public.admin_profiles enable row level security;
alter table public.customer_enquiries enable row level security;
alter table public.loan_applications enable row level security;
alter table public.banks enable row level security;
alter table public.interest_rates enable row level security;
alter table public.website_content enable row level security;
alter table public.website_analytics enable row level security;
alter table public.admin_activity_logs enable row level security;

-- admin_profiles: user can read own; active admins can read all; only active admins update/manage via controlled flows (keep tight)
drop policy if exists admin_profiles_self_read on public.admin_profiles;
create policy admin_profiles_self_read on public.admin_profiles for select using (auth.uid() = id or public.is_active_admin());
drop policy if exists admin_profiles_admin_write on public.admin_profiles;
create policy admin_profiles_admin_write on public.admin_profiles for all using (public.is_active_admin()) with check (public.is_active_admin());

-- customer_enquiries: PUBLIC may INSERT valid enquiries; NO public read/update/delete. Admins full access.
drop policy if exists customer_enquiries_public_insert on public.customer_enquiries;
create policy customer_enquiries_public_insert on public.customer_enquiries for insert to anon, authenticated
with check (
  char_length(trim(customer_name)) between 2 and 120
  and char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 13
  and char_length(trim(email)) between 5 and 160
  and char_length(trim(loan_category)) between 2 and 120
  and (requested_amount is null or requested_amount between 0 and 10000000000)
);
drop policy if exists customer_enquiries_admin_all on public.customer_enquiries;
create policy customer_enquiries_admin_all on public.customer_enquiries for all to authenticated
using (public.is_active_admin()) with check (public.is_active_admin());

-- loan_applications: admin only
drop policy if exists loan_applications_admin_all on public.loan_applications;
create policy loan_applications_admin_all on public.loan_applications for all to authenticated
using (public.is_active_admin()) with check (public.is_active_admin());

-- banks / interest_rates: public read active rows; admin manage
drop policy if exists banks_public_read on public.banks;
create policy banks_public_read on public.banks for select to anon, authenticated using (display_status = true);
drop policy if exists banks_admin_all on public.banks;
create policy banks_admin_all on public.banks for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists interest_rates_public_read on public.interest_rates;
create policy interest_rates_public_read on public.interest_rates for select to anon, authenticated using (active = true);
drop policy if exists interest_rates_admin_all on public.interest_rates;
create policy interest_rates_admin_all on public.interest_rates for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

-- website_content: public read only is_public; admin manage
drop policy if exists website_content_public_read on public.website_content;
create policy website_content_public_read on public.website_content for select to anon, authenticated using (is_public = true);
drop policy if exists website_content_admin_all on public.website_content;
create policy website_content_admin_all on public.website_content for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

-- analytics: allow public INSERT of limited event types (abuse risk: add rate limiting via Edge Function in production). NO public read. Admin read.
drop policy if exists analytics_public_insert on public.website_analytics;
create policy analytics_public_insert on public.website_analytics for insert to anon, authenticated
with check (event_type in ('page_view','unique_visit','cta_click','contact_click','whatsapp_click','phone_click','calculator_interaction','enquiry_submit'));
drop policy if exists analytics_admin_read on public.website_analytics;
create policy analytics_admin_read on public.website_analytics for select to authenticated using (public.is_active_admin());

-- admin logs: admin insert/read
drop policy if exists admin_logs_admin_all on public.admin_activity_logs;
create policy admin_logs_admin_all on public.admin_activity_logs for all to authenticated
using (public.is_active_admin()) with check (public.is_active_admin());

-- IMPORTANT manual setup after migration:
-- 1) Create an admin user in Supabase Auth (email/password). Do not enable public sign-up for admin.
-- 2) Insert matching row: insert into public.admin_profiles (id, email, full_name, is_active) values ('<AUTH_USER_UUID>','admin@example.com','Admin',true);
-- 3) Configure Site URL/redirects for password reset if used.
-- 4) For production, consider moving public inserts (enquiries/analytics) behind Edge Functions with rate limiting/Captcha.