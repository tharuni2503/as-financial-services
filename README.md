# AS Financial Services and Solutions

A premium, multi-page marketing website for **AS Financial Services and Solutions** (Medipally, Hyderabad). Built with **HTML5, CSS3, vanilla JavaScript (ES modules), GSAP + ScrollTrigger, Lucide**, and a progressive **Three.js hero enhancement** (no framework migration). Includes a Supabase-backed **admin dashboard/CRM** integration (requires configuration).

**Slogan:** Your Goals, Our Solutions

## Verified business details

- **Phone:** [+91 91827 03079](tel:+919182703079)
- **WhatsApp:** [wa.me/919182703079](https://wa.me/919182703079)
- **Email:** [asfinancialservicesandsolution@gmail.com](mailto:asfinancialservicesandsolution@gmail.com)
- **Address:** Panchavati Colony Road No. 1, Medipally, Hyderabad, Telangana 500098, India
- **Maps:** [Get directions](https://www.google.com/maps/dir/?api=1&destination=Panchavati+Colony+Road+No.+1%2C+Medipally%2C+Hyderabad%2C+Telangana+500098%2C+India)
- **Opening hours:** not specified — please confirm availability before visiting.

## Services (13)

Personal Loans, Home Loans, Business Loans, Education Loans, Mortgage Loans / Loan Against Property, Private Funds, Project Funding, Insurance, Instant Loans, Open Plot Purchase, New Car Loans, Used Car Loans, and Doctors Loans. Final eligibility, pricing, approval and terms are decided by the relevant lender, fund provider or insurer. No guarantees/approval claims.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Premium hero (progressive Three.js financial-growth canvas + 2D fallback), intro/challenges, 13 services, lender comparison + showcase, process, sticky benefits, testimonials (verified-only), homepage EMI calculator, final enquiry before footer. |
| `services.html` | Professional showcase for all 13 services. |
| `banks.html` | Premium lender comparison (sample/illustrative data) with filters, cards, table and disclaimers. |
| `home-loans.html` | Home-loan journey, eligibility/documents, calculator and FAQs. |
| `about.html` | Business story, values, approach and CTA. |
| `contact.html` | Verified contact details, secure enquiry form (Supabase when configured), map/directions. |
| `privacy.html` / `terms.html` | Policy and terms/disclaimers. |
| `admin/login.html` | Authorized admin login (Supabase Auth). |
| `admin/dashboard.html` | Admin dashboard/CRM (enquiries, applications, banks/rates, analytics, content, exports, logs). **Requires Supabase + authorized admin profile.** |

All pages share header/footer via `js/components.js` and are marked with `data-page`.

## Key features

- **Cinematic 2D scroll animation** (GSAP + ScrollTrigger): hero stagger/clip reveal, scroll reveals, scroll-linked process progress + sequential step activation, sticky benefits storytelling, micro-interactions. No scroll hijacking. Respects `prefers-reduced-motion`.
- **Premium lender comparison** (original AS Financial design): logo container, lender name, interest rate, loan amount, EMI per lakh, processing fee, tenure, updated date, Explore offer + Enquiry. **Show More/Less + filters**. Values are **illustrative samples** unless verified — no invented live rates.
- **Authentic logo handling:** no fake logos, generic icons, or invented partnerships. Renders **verified logo assets when available** (local assets or Supabase Storage); otherwise clean **text wordmarks** (actual lender names). Do not add trademarked assets without verified association/usage rights.
- **Homepage EMI calculator:** reducing-balance EMI with instant recalculation (EMI, principal, total interest, total repayment).
- **Working interactions:** navigation (mobile drawer), calculator, filters/show-more, carousel, FAQ, `tel`/WhatsApp/email/maps links. **Enquiry form:** validates inputs and **submits to Supabase only when configured**; shows success **only after successful storage**. If backend is unavailable/not configured, it shows a clear error and **does not report data as stored**.
- **Live public CMS (when configured):** hero heading/description/badge, contact details, announcement banner, footer copy/disclaimer, service descriptions/visibility/order, lender cards/rates and genuine logo URLs hydrate from public Supabase rows. Cached for 5 minutes; static `js/data.js` remains the fallback.
- **Admin/CRM (when configured):** Supabase Auth + PostgreSQL + RLS, customer enquiries CRM with duplicate detection, follow-up dashboard, loan applications (separate records, assignment, history), bank management with Storage logo upload/replace/delete, interest-rate management, structured CMS editors, first-party analytics with date ranges and charts, multi-sheet Excel/CSV exports, activity logs and a security self-test. No service-role key in frontend. Public visitors cannot read customer records.
- **Responsive + accessible:** semantic HTML, labels, focus states, contrast-minded palette, reduced motion support, responsive admin sidebar/tables/modals.

## Run locally

Requires **Node.js 18+**. No npm dependencies.

```bash
cd as-financial-services
node server.js
# or: npm start
```

Open <http://127.0.0.1:5173/>. Do **not** use `file://` (ES modules/map).

## Editing content

Static fallback content lives in `js/data.js`: `business`, `site`, navigation/legal, services, `banks` (sample/illustrative), FAQs, testimonials, and `contactConfig`. `banks[].logo` can point to a local verified asset (e.g. `assets/logos/banks/sbi.svg`); `wordmark` is used as fallback.

Once Supabase is configured, most public copy is managed from **Admin → Website Content** and **Admin → Bank Management / Interest Rates**. Static values are still used whenever the backend is unavailable.

Styles: `css/style.css` → `components.css` → `animations.css` → `responsive.css`; admin pages use `css/admin.css`. Scripts: Lucide/GSAP/ScrollTrigger vendor + `type="module" src="js/main.js"`.

## Adding verified lender logos (important)

1. Confirm the lender is genuinely relevant/associated as appropriate and that you have **rights to use** the logo asset.
2. Either:
   - add a transparent PNG/JPEG/WebP to `assets/logos/banks/` and set `logo` in `js/data.js`, or
   - upload it in **Admin → Bank Management** (stored in the `bank-logos` Supabase Storage bucket).
3. Missing/broken logos automatically fall back to a clean wordmark. **Never use fake, AI-generated, or unverified brand assets.**
4. SVG uploads are intentionally blocked in Storage (script-capable format). Use PNG, JPEG or WebP (max 2 MB).

## Supabase admin system (setup required)

The admin dashboard, live CMS, real enquiry storage and analytics are **not active until configured**. This repo includes both migrations, RLS/storage policies, the admin UI, the public CMS hydration layer, an optional Edge Function, and frontend integration.

> **Status in this workspace:** Supabase credentials are not available, so live auth, RLS enforcement, Storage uploads, CMS writes and real-data exports could not be end-to-end tested here. Everything below is implemented and syntax/headless-audited; it must be verified against your project.

### 1) Configure the frontend (anon key only)

1. Edit `js/supabase-config.js` (a safe placeholder is committed) with your Supabase **Project URL** and **anon/public key**.
2. Optionally set `SUPABASE_ENQUIRY_FUNCTION` (Edge Function name) and `TURNSTILE_SITE_KEY` (public CAPTCHA site key).
3. **Never** put the `service_role` key in frontend code. `.env.example` is provided for reference only.

`js/backend.js` detects placeholder values and treats the backend as unconfigured, so the public site keeps working and admin redirects to the login page with a clear message.

### 2) Apply migrations (in order)

Run these in the Supabase SQL editor, or with the Supabase CLI:

1. `supabase/migrations/20260507_000001_as_financial_admin.sql`
2. `supabase/migrations/20260507_000002_cms_storage_history.sql`

The first migration creates the core tables and RLS:

`admin_profiles`, `customer_enquiries`, `loan_applications`, `banks`, `interest_rates`, `website_content`, `website_analytics`, `admin_activity_logs`.

The second migration adds:

- `enquiry_history` and `application_history` (immutable audit trail + triggers)
- `banks.type`
- duplicate/follow-up/analytics indexes
- `enquiry_rate_limits` (Edge Function only; no public policies)
- the public `bank-logos` Storage bucket and policies
- seeded public CMS rows for `hero`, `contact`, `announcement`, `footer`, `site`

Both migrations are idempotent (`if not exists` / `drop policy if exists`) and safe to re-run while developing.

### 3) Configure Storage

The second migration creates the `bank-logos` bucket with:

- public read
- admin-only insert/update/delete (`is_active_admin()`)
- allowed MIME types: `image/png`, `image/jpeg`, `image/webp`
- 2 MB size limit

Confirm the bucket and policies in **Supabase → Storage → bank-logos → Policies**. Admin uploads use the path `bank-logos/lenders/<slug>-<timestamp>.<ext>` and store both `logo_path` and `logo_url` on the `banks` row.

### 4) Create an authorized admin (no public admin registration)

1. Create a user in **Supabase Auth** (email/password).
2. Insert an active admin profile using the Auth user UUID:

   ```sql
   insert into public.admin_profiles (id, email, full_name, role, is_active)
   values ('<AUTH_USER_UUID>', 'admin@yourdomain.com', 'Admin', 'admin', true);
   ```

3. Sign in at `/admin/login.html`. Unauthorized or inactive users are blocked by app checks **and** RLS.

Keep public sign-up disabled in Supabase Auth settings.

### 5) Optional: deploy the enquiry Edge Function

`supabase/functions/submit-enquiry/index.ts` adds server-side validation, per-IP rate limiting (hashed, fixed 10-minute window, 5 submissions) and optional Cloudflare Turnstile verification.

```bash
supabase functions deploy submit-enquiry --no-verify-jwt
```

Set these **Edge Function** secrets (never in browser code):

| Secret | Purpose |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Optional; enables CAPTCHA verification |
| `RATE_LIMIT_SALT` | Optional; salt for hashing client IPs |
| `ALLOWED_ORIGINS` | Optional comma-separated allow-list (default `*`) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by Supabase. The function writes to `enquiry_rate_limits` with the service role, then inserts the validated enquiry.

Then set `SUPABASE_ENQUIRY_FUNCTION = "submit-enquiry"` in `js/supabase-config.js`. If left blank, the public form uses the RLS-constrained direct insert.

### 6) Public CMS behaviour

- Public reads only: `website_content.is_public = true`, `banks.display_status = true`, `interest_rates.active = true`.
- Successful reads are cached in `sessionStorage` under `as_cms_cache_v1` for 5 minutes.
- Append `?cms_preview=1` to any public page to bypass the cache and force a fresh read.
- If Supabase is unconfigured/offline or returns no rows, the site silently keeps the static `js/data.js` content.
- Admin saves clear the CMS cache key, so the next public page load refreshes.
- Announcement banners are dismissed per session; disabled announcements never render.

### 7) Security model (verify in your project)

- **Public (anon):** can **INSERT** valid `customer_enquiries` and `website_analytics` events (constrained); can **SELECT** only explicitly public/active rows (`banks`, `interest_rates`, `website_content`). No public read/update/delete of customer records, applications, history, logs or admin profiles.
- **Admin access:** an authenticated user must have an active `admin_profiles` row. `is_active_admin()` is used by table and Storage policies.
- **Storage:** public read of genuine logos only; writes require an active admin.
- **Secrets:** no service-role key in browser code. The Edge Function uses its environment-provided service role.
- **History:** triggers record status/note/follow-up/assignment changes with the acting admin where available.
- **Rate limiting:** the Edge Function fails closed if its counter table is unavailable.
- **Admin self-test:** **Settings → Security self-test** creates a temporary anonymous client and checks that private tables return no rows/errors while public reads succeed. Treat it as indicative; also test from a private browser.
- **SQL smoke test:** `supabase/tests/rls_smoke.sql` simulates anonymous, non-admin, inactive-admin and active-admin sessions (with `set local role` / JWT claims) and verifies private/public reads plus anonymous insert restrictions. It rolls back all changes. Replace the UUID placeholders before running.
- **Public insert hardening:** the second migration re-creates the public enquiry/analytics insert policies so anonymous submissions must use `status = 'New'`, cannot set admin notes/follow-ups, and analytics rows have bounded paths/keys and a near-current event date.

Recommended production checks:

1. Test anonymous reads of every private table (expect 0 rows or permission denied).
2. Test an authenticated non-admin user (expect no private data).
3. Test an inactive admin profile (expect blocked and signed out).
4. Test public Storage read and anonymous upload/delete (expect upload/delete denied).
5. Confirm public enquiry insert works and public read of enquiries fails.
6. Review Auth redirect URLs, password-reset URLs, CSP, and email confirmation settings.
7. Confirm no service-role key appears in any served file.

### 8) Analytics model

- First-party events only: `page_view`, `unique_visit`, `enquiry_submit`, `calculator_interaction`, `phone_click`, `whatsapp_click`, `contact_click`, `cta_click`.
- Admin pages are excluded by the public tracker.
- Unique visitors are an estimate from a random client-side key stored in the browser; they are not verified identities.
- Analytics never stores names, emails, phone numbers or precise locations.
- Dashboard ranges: today, yesterday, 7, 30, 90 days and custom. Views include daily/monthly visitors, page views, top pages, loan-category interest, calculator usage, enquiry conversion and phone/WhatsApp clicks, with explicit empty states when no events exist.

### 9) Exports

- **Export Reports** builds a multi-sheet `.xlsx`: Customer Enquiries, Loan Applications, Bank Information, Interest Rates and Analytics Summary.
- Date-range, status and loan-type filters apply to customer/application rows.
- Sheets include column widths, autofilters and number/date formats (SheetJS Community Edition does not write cell styles such as bold headers).
- CSV exports are also available for enquiries and applications.
- Exported customer data is confidential; store and share it securely.

### 10) Admin feature map

| Area | What it does |
| --- | --- |
| Overview | Real counts, recent enquiries/applications, 14-day page-view chart, quick actions, overdue follow-up badge. |
| Follow-ups | Overdue / due today / next 30 days / later buckets; open record or clear the follow-up date. |
| Customers / Enquiries | Search, status/loan/date filters, sorting, pagination, duplicate detection, profile edit, internal notes, follow-up date, history timeline, delete confirmation, create application. |
| Loan Applications | Separate records; create from an enquiry or directly, edit, assign an active admin, status, notes, history, search/filter/sort, export, delete confirmation. |
| Loan Categories | Demand counts from recorded enquiries/applications; public service visibility/order. |
| Bank Management | Add/edit/delete lenders, display order, enable/disable, logo upload/preview/replace/delete, illustrative flag. |
| Interest Rates | Add/edit/delete rates, active toggle, illustrative flag. |
| Website Analytics | Presets + custom range, charts, top pages/categories, conversion, daily/monthly tables, summary export. |
| Website Content | Structured editors for hero/contact/announcement/footer/site, services editor (description/visibility/order), raw JSON editor with validation. |
| Export Reports | Full workbook + CSV exports with filters. |
| Activity Logs | Admin actions, filterable, JSON detail. |
| Settings | Session info, backend health table checks, Storage check, setup checklist, anonymous security self-test. |

### 11) Behaviour when not configured / unavailable

- Public enquiry form shows a **clear error** and **does not report data as stored**.
- When configured and successful, it shows success **only after confirmed storage** and records source/status `New`.
- Analytics calls fail silently and never break the site.
- Admin dashboard redirects to `admin/login.html?err=config`; the login page explains that Supabase is not configured.
- The public site keeps rendering static fallback content.

### 12) Testing performed in this workspace

- `node --check` passed for `js/admin/dashboard.js`, `js/cms.js`, `js/backend.js`, `js/render.js`, `js/forms.js`, `js/main.js`, `js/components.js`.
- Headless Chrome audit of all 8 public pages at 1440, 768 and 390 px: no console errors, no page exceptions, no failed local requests, no horizontal overflow, one `h1` per page, no broken images.
- Additional audit at 1366 and 320 px: no console/page errors, no failed requests, no overflow, no broken images.
- With placeholder config: public pages keep static content, no announcement renders, no errors; `/admin/dashboard.html` redirects to `admin/login.html?err=config`; the login page shows the configuration message.
- The Edge Function is TypeScript/Deno code. It was syntax-transpiled with esbuild and reviewed, but **not deployed or executed here** (no Deno/Supabase CLI or project credentials in this environment).
- `supabase/tests/rls_smoke.sql` was authored for the Supabase SQL editor but **not executed here** because no project is connected.

### 13) Known limitations / still requires your Supabase project

- Live Auth sign-in, password reset and session refresh.
- Live RLS enforcement across all roles (anonymous, authenticated non-admin, active admin, inactive admin).
- Storage upload/preview/replace/delete and bucket policy verification.
- Live CMS reads/writes and cache invalidation against real rows.
- Real enquiry inserts, analytics events, CRM edits, follow-up scheduling and history triggers.
- Real multi-sheet XLSX/CSV exports with production data.
- Edge Function deployment, Turnstile keys and rate-limit behaviour.
- Browser-level CAPTCHA rendering (only activates when `TURNSTILE_SITE_KEY` is set).
- Email notifications/reminders are **not** implemented; follow-ups are dashboard-only.
- No automated browser test suite is committed; the headless audits were run ad hoc.

### 14) Privacy

Collect only necessary enquiry fields; do **not** collect IDs/passwords/bank credentials/OTPs/sensitive documents via the public form. Analytics stores event metadata and a client-generated visitor key (not PII). Exported customer data is confidential. Do not claim compliance certification without verification.

## Launch checklist

- Verify/confirm any details before publishing (hours, lender data, reviews, partnerships).
- Replace `https://example.com` canonicals and set production metadata.
- Bank rates/EMI/fees/tenures are **indicative samples** — update `site.banksLastUpdated` and lender entries with verified terms or keep clearly marked as samples.
- Testimonials: use only verified reviews (`verifiedReviews`).
- Configure Supabase, apply both migrations, create an active admin, and verify RLS/Storage policies.
- Never expose secret keys in browser code.
- Review privacy/cookie consent requirements for your jurisdiction.

## Deployment

Static site — deploy the `as-financial-services` folder to Netlify, Vercel, GitHub Pages, or Cloudflare Pages (no build step; publish root containing `index.html`). The admin dashboard and Edge Function require the Supabase project to be configured separately.

## Credits / licences

- **Photos:** royalty-free stock imagery (hero/about/section images). Record exact photographer/source/licence URLs before commercial publication.
- **Fonts:** Manrope, DM Sans, Playfair Display (SIL OFL), self-hosted.
- **Libraries (vendored):** Three.js r169 module (MIT, progressive hero enhancement), GSAP 3.12.5 + ScrollTrigger (GreenSock licence — review for commercial use), Lucide (ISC). Admin uses SheetJS (`xlsx`) via CDN for Excel export. Supabase JS is loaded via CDN ESM when configured.

Lender names may appear for comparison; the site does **not** claim affiliation/endorsement/partnership. Always confirm terms with the lender.
