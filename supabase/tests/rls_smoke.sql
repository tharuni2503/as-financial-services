-- AS Financial Services — RLS & Storage smoke tests
--
-- Run in the Supabase SQL editor AFTER both migrations. Everything is wrapped
-- in a transaction that is rolled back, so no test data is kept.
--
-- Replace the placeholders:
--   <ACTIVE_ADMIN_UUID>    an active admin_profiles.id (Auth user UUID)
--   <INACTIVE_ADMIN_UUID>  an admin_profiles.id with is_active = false
--   <NON_ADMIN_UUID>       an Auth user with no admin_profiles row
--
-- How to read results:
--   * "permission denied" or 0 rows for private tables = expected for anon /
--     non-admin / inactive admin.
--   * A successful public insert (then rolled back) = expected for enquiries.
--   * An RLS violation for status <> 'New' = expected (hardened policy).
--
-- This script does not replace a real browser test from a private window.

begin;

-- ---------------------------------------------------------------------------
-- 1. Anonymous (anon) reads: private tables must be empty / denied
-- ---------------------------------------------------------------------------
set local role anon;

select 'anon customer_enquiries (expect 0)' as check, count(*) from public.customer_enquiries;
select 'anon loan_applications (expect 0)' as check, count(*) from public.loan_applications;
select 'anon website_analytics (expect 0)' as check, count(*) from public.website_analytics;
select 'anon admin_activity_logs (expect 0)' as check, count(*) from public.admin_activity_logs;
select 'anon admin_profiles (expect 0)' as check, count(*) from public.admin_profiles;
select 'anon enquiry_history (expect 0)' as check, count(*) from public.enquiry_history;
select 'anon application_history (expect 0)' as check, count(*) from public.application_history;

-- Public reads that SHOULD work
select 'anon banks (expect >= 0, no error)' as check, count(*) from public.banks where display_status = true;
select 'anon interest_rates (expect >= 0, no error)' as check, count(*) from public.interest_rates where active = true;
select 'anon website_content (expect >= 0, no error)' as check, count(*) from public.website_content where is_public = true;

-- Anonymous insert of a valid enquiry: should succeed
insert into public.customer_enquiries
  (customer_name, phone, email, loan_category, requested_amount, status)
values
  ('RLS Smoke Test', '9000000000', 'rls-smoke@example.com', 'Personal Loan', 100000, 'New');

-- Anonymous insert with a privileged status: must fail with RLS violation
-- (uncomment to verify; the statement is expected to error)
-- insert into public.customer_enquiries
--   (customer_name, phone, email, loan_category, status)
-- values
--   ('RLS Smoke Test', '9000000001', 'rls-smoke2@example.com', 'Personal Loan', 'Approved');

-- Anonymous update/delete: must affect 0 rows
update public.customer_enquiries set status = 'Approved' where customer_name = 'RLS Smoke Test';
delete from public.customer_enquiries where customer_name = 'RLS Smoke Test';

-- Anonymous storage writes: must be denied
-- insert into storage.objects (bucket_id, name) values ('bank-logos', 'rls-smoke.png');
-- delete from storage.objects where bucket_id = 'bank-logos' and name = 'rls-smoke.png';

-- Public storage read: should succeed
select 'anon storage bank-logos objects (expect >= 0, no error)' as check, count(*)
from storage.objects where bucket_id = 'bank-logos';

-- ---------------------------------------------------------------------------
-- 2. Authenticated non-admin: must not read private tables
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<NON_ADMIN_UUID>","role":"authenticated"}';

select 'non-admin customer_enquiries (expect 0)' as check, count(*) from public.customer_enquiries;
select 'non-admin loan_applications (expect 0)' as check, count(*) from public.loan_applications;
select 'non-admin website_analytics (expect 0)' as check, count(*) from public.website_analytics;

-- ---------------------------------------------------------------------------
-- 3. Inactive admin: must not read private tables
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<INACTIVE_ADMIN_UUID>","role":"authenticated"}';

select 'inactive admin customer_enquiries (expect 0)' as check, count(*) from public.customer_enquiries;
select 'inactive admin loan_applications (expect 0)' as check, count(*) from public.loan_applications;
select 'inactive admin website_analytics (expect 0)' as check, count(*) from public.website_analytics;

-- ---------------------------------------------------------------------------
-- 4. Active admin: must be able to read private tables
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<ACTIVE_ADMIN_UUID>","role":"authenticated"}';

select 'active admin customer_enquiries (expect no error)' as check, count(*) from public.customer_enquiries;
select 'active admin loan_applications (expect no error)' as check, count(*) from public.loan_applications;
select 'active admin website_analytics (expect no error)' as check, count(*) from public.website_analytics;
select 'active admin admin_profiles (expect no error)' as check, count(*) from public.admin_profiles;
select 'active admin enquiry_history (expect no error)' as check, count(*) from public.enquiry_history;
select 'active admin application_history (expect no error)' as check, count(*) from public.application_history;

-- Active admin storage write should be allowed (then rolled back)
-- insert into storage.objects (bucket_id, name) values ('bank-logos', 'rls-smoke.png');
-- delete from storage.objects where bucket_id = 'bank-logos' and name = 'rls-smoke.png';

-- ---------------------------------------------------------------------------
-- 5. Clean up
-- ---------------------------------------------------------------------------
rollback;
