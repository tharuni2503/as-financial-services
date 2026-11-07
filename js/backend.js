/**
 * Supabase backend integration (progressive). Uses the public anon key only.
 * If not configured, callers must show a clear non-success state.
 *
 * Never put a service_role key in this file or anywhere in the browser.
 */
let _client = null;
let _config = null;

const isPlaceholder = (value, marker) =>
  !value || String(value).includes(marker) || String(value).includes('YOUR_');

export async function getConfig() {
  if (_config !== null) return _config;
  try {
    const mod = await import('./supabase-config.js');
    if (
      !isPlaceholder(mod.SUPABASE_URL, 'YOUR_PROJECT_REF') &&
      !isPlaceholder(mod.SUPABASE_ANON_KEY, 'YOUR_SUPABASE_ANON_PUBLIC_KEY')
    ) {
      _config = {
        url: mod.SUPABASE_URL,
        key: mod.SUPABASE_ANON_KEY,
        enquiryFunction: mod.SUPABASE_ENQUIRY_FUNCTION || '',
        turnstileSiteKey: mod.TURNSTILE_SITE_KEY || ''
      };
    } else {
      _config = false;
    }
  } catch {
    _config = false;
  }
  return _config || null;
}

export async function isBackendConfigured() {
  return !!(await getConfig());
}

export async function getClient() {
  if (_client) return _client;
  const cfg = await getConfig();
  if (!cfg) return null;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  _client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return _client;
}

export function visitorKey() {
  try {
    const k = localStorage.getItem('as_vk');
    if (k) return k;
    const n =
      (crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)) +
      Date.now();
    localStorage.setItem('as_vk', n);
    return n;
  } catch {
    return 'na';
  }
}

export async function trackEvent(event_type, meta = {}) {
  try {
    if (location.pathname.includes('/admin')) return; // exclude admin traffic
    const client = await getClient();
    if (!client) return;
    await client.from('website_analytics').insert({
      event_type,
      page_path: location.pathname + location.search,
      referrer: document.referrer ? new URL(document.referrer, location.href).pathname : null,
      visitor_key: visitorKey(),
      meta
    });
  } catch {
    /* analytics must never break the site */
  }
}

/**
 * Submit an enquiry. When an Edge Function is configured it is used (captcha +
 * server-side rate limiting). Otherwise a direct RLS-constrained insert is used.
 * Success is only returned after the database confirms storage.
 */
export async function submitEnquiry(payload, captchaToken = '') {
  const cfg = await getConfig();
  if (!cfg) return { ok: false, reason: 'not_configured' };

  if (cfg.enquiryFunction) {
    try {
      const res = await fetch(`${cfg.url}/functions/v1/${cfg.enquiryFunction}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`
        },
        body: JSON.stringify({ payload, captchaToken })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          reason: body.reason || 'function_error',
          message: body.message || `Request failed (${res.status})`
        };
      }
      return { ok: true, id: body.id };
    } catch (error) {
      return { ok: false, reason: 'network_error', message: error.message };
    }
  }

  const client = await getClient();
  if (!client) return { ok: false, reason: 'not_configured' };
  const { data, error } = await client.from('customer_enquiries').insert(payload).select('id').single();
  if (error) return { ok: false, reason: 'db_error', message: error.message };
  return { ok: true, id: data && data.id };
}

export async function requireAdminSession(redirectTo = './login.html') {
  const client = await getClient();
  if (!client) {
    location.href = redirectTo + '?err=config';
    return null;
  }
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    location.href = redirectTo;
    return null;
  }
  const { data: profile } = await client
    .from('admin_profiles')
    .select('id,full_name,email,role,is_active')
    .eq('id', session.user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) {
    await client.auth.signOut();
    location.href = redirectTo + '?err=unauthorized';
    return null;
  }
  return { client, session, profile };
}

/** Public, cache-friendly content reads used by the live CMS. */
export async function fetchPublicCms() {
  const client = await getClient();
  if (!client) return null;
  const [content, banks, rates] = await Promise.all([
    client.from('website_content').select('key,value,is_public,updated_at').eq('is_public', true),
    client.from('banks').select('*').eq('display_status', true).order('display_order', { ascending: true }),
    client.from('interest_rates').select('*').eq('active', true).order('last_updated', { ascending: false })
  ]);
  if (content.error && banks.error && rates.error) return null;
  return {
    content: Object.fromEntries((content.data || []).map((row) => [row.key, row.value])),
    banks: banks.data || [],
    rates: rates.data || [],
    fetchedAt: new Date().toISOString()
  };
}
