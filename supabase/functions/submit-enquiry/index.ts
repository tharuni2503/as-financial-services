// AS Financial Services — public enquiry Edge Function.
//
// Purpose: server-side validation + rate limiting (+ optional Cloudflare
// Turnstile) before inserting a public enquiry. This is optional hardening;
// the direct RLS-constrained insert remains the fallback.
//
// Deploy:
//   supabase functions deploy submit-enquiry --no-verify-jwt
// Secrets (Edge Function environment only — never in browser code):
//   TURNSTILE_SECRET_KEY   optional, enables CAPTCHA verification
//   RATE_LIMIT_SALT        optional, salt used when hashing client IPs
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Then set SUPABASE_ENQUIRY_FUNCTION = "submit-enquiry" in
// js/supabase-config.js and (optionally) TURNSTILE_SITE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const WINDOW_MS = 10 * 60 * 1000; // 10-minute fixed window
const MAX_PER_WINDOW = 5; // max enquiries per IP per window
const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const allowAll = ALLOWED_ORIGINS.includes("*");
  const allowed = allowAll || (origin && ALLOWED_ORIGINS.includes(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin || "*" : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

const clean = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Validated =
  | { ok: false; errors: string[] }
  | { ok: true; value: Record<string, unknown> };

function validate(payload: Record<string, unknown>): Validated {
  const customer_name = clean(payload.customer_name, 120);
  const phone = digits(payload.phone);
  const email = clean(payload.email, 200);
  const loan_category = clean(payload.loan_category, 120);
  const employment_type = clean(payload.employment_type, 80) || null;
  const city_location = clean(payload.city_location, 120) || null;
  const message = clean(payload.message, 2000) || null;
  const source_page = clean(payload.source_page, 300) || null;

  const rawAmount = String(payload.requested_amount ?? "").replace(/[^\d.]/g, "");
  const requested_amount = rawAmount ? Number(rawAmount) : null;

  const errors: string[] = [];
  if (customer_name.length < 2) errors.push("A valid name is required.");
  if (phone.length < 10 || phone.length > 15) errors.push("A valid phone number is required.");
  if (!EMAIL_RE.test(email)) errors.push("A valid email address is required.");
  if (loan_category.length < 2) errors.push("A loan category is required.");
  if (requested_amount !== null && (!Number.isFinite(requested_amount) || requested_amount < 0)) {
    errors.push("Requested amount must be a positive number.");
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      customer_name,
      phone,
      email,
      loan_category,
      requested_amount,
      employment_type,
      city_location,
      message,
      source_page,
      status: "New"
    }
  };
}

async function hashIp(ip: string) {
  const salt = Deno.env.get("RATE_LIMIT_SALT") || "as-financial-enquiry";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token: string, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return { ok: true, skipped: true }; // CAPTCHA not configured
  if (!token) return { ok: false, reason: "captcha_failed", message: "Please complete the CAPTCHA." };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const result = await res.json().catch(() => ({}));
    if (result?.success) return { ok: true };
    return { ok: false, reason: "captcha_failed", message: "CAPTCHA verification failed. Please try again." };
  } catch {
    return { ok: false, reason: "captcha_failed", message: "CAPTCHA verification is temporarily unavailable." };
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed", message: "Use POST." }, 405, origin);
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) {
    return json({ ok: false, reason: "payload_too_large", message: "Request is too large." }, 413, origin);
  }

  let body: { payload?: Record<string, unknown>; captchaToken?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json", message: "Invalid request body." }, 400, origin);
  }

  const payload = body?.payload;
  if (!payload || typeof payload !== "object") {
    return json({ ok: false, reason: "validation_error", message: "Missing enquiry payload." }, 400, origin);
  }

  const checked = validate(payload);
  if (!checked.ok) {
    return json(
      { ok: false, reason: "validation_error", message: checked.errors.join(" ") },
      422,
      origin
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(
      { ok: false, reason: "not_configured", message: "Enquiry service is not configured." },
      503,
      origin
    );
  }

  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";

  const captcha = await verifyTurnstile(clean(body?.captchaToken, 2048), clientIp || null);
  if (!captcha.ok) {
    return json({ ok: false, reason: captcha.reason, message: captcha.message }, 400, origin);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Rate limiting: hashed IP + fixed window counter. Anonymous clients have no
  // policy on enquiry_rate_limits, so only this service-role function can write.
  try {
    const ipHash = await hashIp(clientIp || "unknown");
    const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();

    const { data: current, error: readError } = await admin
      .from("enquiry_rate_limits")
      .select("count")
      .eq("ip_hash", ipHash)
      .eq("window_start", windowStart)
      .maybeSingle();

    if (readError) throw readError;

    const used = current?.count ?? 0;
    if (used >= MAX_PER_WINDOW) {
      return json(
        {
          ok: false,
          reason: "rate_limited",
          message: "Too many enquiries from this connection. Please try again later."
        },
        429,
        origin
      );
    }

    const { error: writeError } = await admin
      .from("enquiry_rate_limits")
      .upsert(
        { ip_hash: ipHash, window_start: windowStart, count: used + 1 },
        { onConflict: "ip_hash,window_start" }
      );
    if (writeError) throw writeError;
  } catch (error) {
    // Fail closed: never bypass rate limiting when the counter is unavailable.
    console.error("rate limit error", error);
    return json(
      { ok: false, reason: "rate_limit_unavailable", message: "Enquiry service is temporarily unavailable." },
      503,
      origin
    );
  }

  const { data, error } = await admin
    .from("customer_enquiries")
    .insert(checked.value)
    .select("id")
    .single();

  if (error) {
    console.error("insert error", error);
    return json(
      { ok: false, reason: "db_error", message: "Could not save the enquiry. Please try again." },
      500,
      origin
    );
  }

  return json({ ok: true, id: data?.id }, 200, origin);
});
