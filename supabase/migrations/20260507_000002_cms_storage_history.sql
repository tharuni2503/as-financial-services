-- AS Financial Services: CMS binding, storage, history, rate limiting
-- Run AFTER 20260507_000001_as_financial_admin.sql.
-- Review every policy in the Supabase dashboard before production.

-- ---------------------------------------------------------------------------
-- 1. Enquiry + application history (immutable audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.enquiry_history (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.customer_enquiries(id) on delete cascade,
  admin_id uuid references public.admin_profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','status_change','follow_up','note','application_created','deleted')),
  status_from text,
  status_to text,
  follow_up_date date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_enquiry_history_enquiry on public.enquiry_history (enquiry_id, created_at desc);

create table if not exists public.application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications(id) on delete cascade,
  admin_id uuid references public.admin_profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','status_change','follow_up','note','assigned','updated')),
  status_from text,
  status_to text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_application_history_app on public.application_history (application_id, created_at desc);

alter table public.enquiry_history enable row level security;
alter table public.application_history enable row level security;

drop policy if exists enquiry_history_admin_read on public.enquiry_history;
create policy enquiry_history_admin_read on public.enquiry_history
  for select to authenticated using (public.is_active_admin());

drop policy if exists enquiry_history_admin_insert on public.enquiry_history;
create policy enquiry_history_admin_insert on public.enquiry_history
  for insert to authenticated with check (public.is_active_admin());

drop policy if exists application_history_admin_read on public.application_history;
create policy application_history_admin_read on public.application_history
  for select to authenticated using (public.is_active_admin());

drop policy if exists application_history_admin_insert on public.application_history;
create policy application_history_admin_insert on public.application_history
  for insert to authenticated with check (public.is_active_admin());

-- Automatic history rows. Security definer so the trigger can write history
-- even when a public (anon) enquiry insert fires it.
create or replace function public.log_enquiry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.enquiry_history (enquiry_id, admin_id, event_type, status_to, note)
    values (new.id, auth.uid(), 'created', new.status, 'Enquiry received');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.enquiry_history (enquiry_id, admin_id, event_type, status_from, status_to, note)
      values (new.id, auth.uid(), 'status_change', old.status, new.status, 'Status updated');
    end if;
    if new.follow_up_date is distinct from old.follow_up_date then
      insert into public.enquiry_history (enquiry_id, admin_id, event_type, follow_up_date, note)
      values (new.id, auth.uid(), 'follow_up', new.follow_up_date, 'Follow-up date updated');
    end if;
    if new.admin_notes is distinct from old.admin_notes then
      insert into public.enquiry_history (enquiry_id, admin_id, event_type, note)
      values (new.id, auth.uid(), 'note', 'Internal note updated');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enquiry_history on public.customer_enquiries;
create trigger trg_enquiry_history
  after insert or update on public.customer_enquiries
  for each row execute function public.log_enquiry_change();

create or replace function public.log_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_history (application_id, admin_id, event_type, status_to, note)
    values (new.id, auth.uid(), 'created', new.status, 'Application created');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.application_history (application_id, admin_id, event_type, status_from, status_to, note)
      values (new.id, auth.uid(), 'status_change', old.status, new.status, 'Status updated');
    end if;
    if new.assigned_admin is distinct from old.assigned_admin then
      insert into public.application_history (application_id, admin_id, event_type, note)
      values (new.id, auth.uid(), 'assigned', 'Assigned administrator changed');
    end if;
    if new.notes is distinct from old.notes then
      insert into public.application_history (application_id, admin_id, event_type, note)
      values (new.id, auth.uid(), 'note', 'Internal notes updated');
    end if;
    if new.follow_up_date is distinct from old.follow_up_date then
      insert into public.application_history (application_id, admin_id, event_type, note)
      values (new.id, auth.uid(), 'follow_up', 'Follow-up date updated');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_application_history on public.loan_applications;
create trigger trg_application_history
  after insert or update on public.loan_applications
  for each row execute function public.log_application_change();

-- ---------------------------------------------------------------------------
-- 2. Small schema additions used by the admin UI
-- ---------------------------------------------------------------------------
alter table public.banks add column if not exists type text;

-- Harden the public insert policies. The base migration allowed anonymous
-- clients to supply any status/notes/follow-up values; these policies keep
-- public submissions strictly in the "New" state with bounded fields.
drop policy if exists customer_enquiries_public_insert on public.customer_enquiries;
create policy customer_enquiries_public_insert on public.customer_enquiries
  for insert to anon, authenticated
  with check (
    status = 'New'
    and admin_notes is null
    and follow_up_date is null
    and char_length(trim(customer_name)) between 2 and 120
    and char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 13
    and char_length(trim(email)) between 5 and 160
    and char_length(trim(loan_category)) between 2 and 120
    and (requested_amount is null or requested_amount between 0 and 10000000000)
  );

drop policy if exists analytics_public_insert on public.website_analytics;
create policy analytics_public_insert on public.website_analytics
  for insert to anon, authenticated
  with check (
    event_type in ('page_view','unique_visit','cta_click','contact_click','whatsapp_click','phone_click','calculator_interaction','enquiry_submit')
    and (page_path is null or char_length(page_path) <= 500)
    and (visitor_key is null or char_length(visitor_key) <= 120)
    and event_date between (current_date - 1) and (current_date + 1)
  );

-- ---------------------------------------------------------------------------
-- 3. CRM indexes: duplicate detection + follow-ups
-- ---------------------------------------------------------------------------
create index if not exists idx_enq_phone_norm on public.customer_enquiries ((regexp_replace(phone, '\D', '', 'g')));
create index if not exists idx_enq_email_lower on public.customer_enquiries ((lower(email)));
create index if not exists idx_enq_follow_up on public.customer_enquiries (follow_up_date)
  where follow_up_date is not null;
create index if not exists idx_enq_created on public.customer_enquiries (created_at desc);
create index if not exists idx_apps_status on public.loan_applications (status);
create index if not exists idx_apps_assigned on public.loan_applications (assigned_admin);
create index if not exists idx_apps_follow_up on public.loan_applications (follow_up_date)
  where follow_up_date is not null;

-- Analytics aggregation indexes
create index if not exists idx_analytics_type_date on public.website_analytics (event_type, event_date desc);
create index if not exists idx_analytics_page on public.website_analytics (page_path);
create index if not exists idx_analytics_meta on public.website_analytics using gin (meta);

-- ---------------------------------------------------------------------------
-- 3. Public submission rate limiting (used by Edge Function with service role)
-- ---------------------------------------------------------------------------
create table if not exists public.enquiry_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip_hash, window_start)
);
alter table public.enquiry_rate_limits enable row level security;
-- Deliberately no policies: only the service role (Edge Function) may access.

create or replace function public.prune_enquiry_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.enquiry_rate_limits where window_start < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket + policies for genuine lender logos
--    Allowed: PNG/JPEG/WebP, max 2 MB. No SVG (script-capable).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bank-logos', 'bank-logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bank_logos_public_read on storage.objects;
create policy bank_logos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'bank-logos');

drop policy if exists bank_logos_admin_insert on storage.objects;
create policy bank_logos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bank-logos' and public.is_active_admin());

drop policy if exists bank_logos_admin_update on storage.objects;
create policy bank_logos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'bank-logos' and public.is_active_admin())
  with check (bucket_id = 'bank-logos' and public.is_active_admin());

drop policy if exists bank_logos_admin_delete on storage.objects;
create policy bank_logos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'bank-logos' and public.is_active_admin());

-- ---------------------------------------------------------------------------
-- 5. Seed public CMS content with the current static values.
--    These are safe to read publicly; admins can edit them in the dashboard.
-- ---------------------------------------------------------------------------
insert into public.website_content (key, value, is_public)
values
  ('hero', jsonb_build_object(
      'title', 'Your Financial Goals.',
      'accent', 'Our Expert Guidance.',
      'description', 'Explore financial solutions for your home, business, education and personal needs with guidance from AS Financial Services and Solutions.',
      'badge', 'Medipally, Hyderabad · Your Goals, Our Solutions',
      'note', 'Loan and insurance terms are subject to eligibility, documentation and provider or lender policies.'
  ), true),
  ('contact', jsonb_build_object(
      'phone', '+91 91827 03079',
      'phoneTel', '+919182703079',
      'whatsapp', '919182703079',
      'email', 'asfinancialservicesandsolution@gmail.com',
      'address', 'Panchavati Colony Road No. 1, Medipally, Hyderabad, Telangana 500098, India',
      'tagline', 'Your Goals, Our Solutions',
      'hoursNote', 'Opening hours are not specified — please confirm availability before visiting.'
  ), true),
  ('announcement', jsonb_build_object(
      'enabled', false,
      'text', '',
      'link', '',
      'label', ''
  ), true),
  ('footer', jsonb_build_object(
      'intro', 'Your Goals, Our Solutions. Clear guidance for loans, mortgage needs, private funds, project funding and insurance enquiries.',
      'disclaimer', 'AS Financial Services and Solutions is a loan advisory service. We are not a bank, NBFC or lender and do not guarantee loan approval, interest rates, fees or processing timelines. All loan applications are assessed solely by the lender and are subject to its policies, eligibility criteria and documentation requirements.'
  ), true),
  ('site', jsonb_build_object('banksLastUpdated', '07 Nov 2026'), true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Verification queries (run manually after applying)
-- ---------------------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
-- select polname, polcmd, polroles::text, polqual from pg_policies where schemaname = 'public' order by tablename, polname;
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'bank-logos';
