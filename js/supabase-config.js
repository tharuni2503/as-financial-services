// Frontend Supabase config (PUBLIC anon key only).
// Replace placeholders with your project values for real backend operation.
// WARNING: Never put service_role keys here. Do not commit private project secrets.
export const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
export const ADMIN_DASHBOARD_PATH = "/admin/dashboard.html";

// Optional production hardening:
// Deploy supabase/functions/submit-enquiry and set its name here to enable
// server-side rate limiting + optional CAPTCHA. Leave blank to use the
// RLS-constrained direct insert.
export const SUPABASE_ENQUIRY_FUNCTION = "";

// Optional Cloudflare Turnstile site key (public). Leave blank to disable.
// The matching secret belongs only in the Edge Function environment.
export const TURNSTILE_SITE_KEY = "";
