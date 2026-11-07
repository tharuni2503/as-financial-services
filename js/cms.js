/**
 * Live CMS hydration for the public website.
 *
 * - Reads only explicitly public Supabase rows (website_content.is_public,
 *   banks.display_status, interest_rates.active).
 * - Caches successful reads in sessionStorage for a few minutes.
 * - Falls back silently to the existing static content in js/data.js when the
 *   backend is unconfigured, offline, or returns no rows.
 * - Never throws: the public site must keep working without Supabase.
 */
import { business, site, services as staticServices } from './data.js';
import { fetchPublicCms, getConfig } from './backend.js';
import { renderFooter } from './components.js';
import { applyCmsContent, initCurrentYear } from './render.js';

const CACHE_KEY = 'as_cms_cache_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const refreshIcons = () => {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.fetchedAt) return null;
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable in private mode */
  }
}

export function clearCmsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(value);
  }
}

function formatIndianNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function lakhCrore(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 2)} L`;
  return `₹${formatIndianNumber(n)}`;
}

function wordmarkFor(name = '') {
  const cleaned = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').trim();
  if (!cleaned) return 'Lender';
  const words = cleaned.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 8);
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

async function mapBanks(rows, rates, cfg) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const tones = ['powder', 'lavender', 'peach', 'sage', 'ivory'];
  const rateList = Array.isArray(rates) ? rates : [];

  return rows.map((row, index) => {
    const rateRow = rateList.find(
      (r) => String(r.lender_name || '').toLowerCase() === String(row.name || '').toLowerCase()
    );
    const rateSource = rateRow
      ? [rateRow.min_rate, rateRow.max_rate].filter((v) => v !== null && v !== undefined).join(' – ')
      : row.interest_rate_text || '';
    const numericRate = String(rateSource).match(/\d+(?:\.\d+)?/);
    const amountRange =
      row.min_loan_amount || row.max_loan_amount
        ? [lakhCrore(row.min_loan_amount), lakhCrore(row.max_loan_amount)].filter(Boolean).join(' – ')
        : 'Varies by lender';
    const tenure =
      [row.min_tenure, row.max_tenure].filter(Boolean).join(' – ') || 'Varies by lender';
    const logo =
      row.logo_url ||
      (row.logo_path && cfg ? `${cfg.url}/storage/v1/object/public/bank-logos/${row.logo_path}` : '');

    return {
      id: row.id,
      name: row.name,
      shortName: row.name,
      wordmark: wordmarkFor(row.name),
      type: row.type || 'Lender',
      rate: numericRate ? numericRate[0] : '—',
      emiPerLakh: row.emi_per_lakh || '—',
      amountRange,
      processingFee: row.processing_fee || 'As per lender',
      tenure,
      updated: formatDate(row.last_updated) || site.banksLastUpdated,
      tone: tones[index % tones.length],
      logo,
      illustrative: row.illustrative !== false,
      websiteUrl: row.website_url || '',
      description: row.description || ''
    };
  });
}

function mergeServices(overrides) {
  if (!Array.isArray(overrides) || !overrides.length) return null;
  const byId = new Map(staticServices.map((service) => [service.id, { ...service }]));
  overrides.forEach((override) => {
    if (!override || !override.id) return;
    const base = byId.get(override.id) || {
      id: override.id,
      title: override.title || override.id,
      tag: override.tag || 'Financial guidance',
      icon: override.icon || 'hand-coins',
      image: override.image || 'assets/images/consultation.jpg',
      alt: override.alt || 'AS Financial Services guidance',
      description: '',
      details: [],
      cta: { label: 'Enquire now', href: 'contact.html' }
    };
    const merged = { ...base, ...override };
    merged.visible = override.visible !== false;
    merged.details = Array.isArray(override.details) && override.details.length
      ? override.details
      : base.details;
    merged.cta = override.cta && override.cta.href ? override.cta : base.cta;
    byId.set(merged.id, merged);
  });
  return [...byId.values()]
    .filter((service) => service.visible !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function applyHero(hero) {
  if (!hero || typeof hero !== 'object') return;
  const titleEl = document.querySelector('#hero-title');
  if (titleEl && (hero.title || hero.accent)) {
    titleEl.innerHTML = `${escapeHtml(hero.title || '')}${
      hero.accent ? ` <em>${escapeHtml(hero.accent)}</em>` : ''
    }`;
  }
  const lede = document.querySelector('.hero__lede');
  if (lede && hero.description) lede.textContent = hero.description;
  const badge = document.querySelector('.hero__badge');
  if (badge && hero.badge) {
    badge.innerHTML = `<i data-lucide="map-pin" aria-hidden="true"></i> ${escapeHtml(hero.badge)}`;
  }
  const note = document.querySelector('.hero__note');
  if (note && hero.note) note.textContent = hero.note;
}

function applyContact(contact) {
  if (!contact || typeof contact !== 'object') return;
  const phone = contact.phone || business.phone.display;
  const phoneDigits = digitsOnly(contact.phoneTel || contact.phone || business.phone.tel);
  const whatsappDigits = digitsOnly(contact.whatsapp || phoneDigits);
  const email = contact.email || business.email.address;
  const address = contact.address || business.addressLine;

  document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
    if (phoneDigits) a.setAttribute('href', `tel:+${phoneDigits}`);
  });
  document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
    if (whatsappDigits) a.setAttribute('href', `https://wa.me/${whatsappDigits}`);
  });
  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    if (email) a.setAttribute('href', `mailto:${email}`);
  });

  const setTile = (selector, label) => {
    document.querySelectorAll(selector).forEach((a) => {
      const p = a.querySelector('p');
      if (p && label) p.textContent = label;
    });
  };
  setTile('a[data-contact="call"]', phone);
  setTile('a[data-contact="email"]', email);
  setTile('a[data-contact="whatsapp"]', phone);

  document.querySelectorAll('[data-business-address]').forEach((el) => {
    if (address) el.textContent = address;
  });

  if (address) {
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    document.querySelectorAll('a[href*="google.com/maps/dir"]').forEach((a) => {
      a.setAttribute('href', mapUrl);
    });
    business.mapUrl = mapUrl;
    business.addressLine = escapeHtml(address);
    business.addressNote = escapeHtml(address);
  }
  if (phone) {
    business.phone = {
      ...business.phone,
      display: escapeHtml(phone),
      tel: phoneDigits ? `+${phoneDigits}` : business.phone.tel
    };
  }
  if (whatsappDigits) business.whatsapp = { ...business.whatsapp, number: whatsappDigits };
  if (email) {
    business.email = {
      ...business.email,
      display: escapeHtml(email),
      // Strip characters that could break out of the mailto: attribute.
      address: String(email).replace(/["'<>\s]/g, '')
    };
  }
  if (contact.tagline) {
    business.tagline = escapeHtml(contact.tagline);
    business.slogan = escapeHtml(contact.tagline);
  }
  if (contact.hoursNote) business.hoursNote = escapeHtml(contact.hoursNote);
}

function applyAnnouncement(announcement) {
  const existing = document.querySelector('[data-announcement]');
  if (existing) existing.remove();
  if (!announcement || !announcement.enabled || !String(announcement.text || '').trim()) return;

  const key = 'as_announcement_dismissed';
  const signature = String(announcement.text).slice(0, 80);
  try {
    if (sessionStorage.getItem(key) === signature) return;
  } catch {
    /* ignore */
  }

  const banner = document.createElement('div');
  banner.className = 'announcement';
  banner.setAttribute('data-announcement', '');
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <div class="container announcement__inner">
      <p>${escapeHtml(announcement.text)}</p>
      ${
        announcement.link
          ? `<a class="announcement__link" href="${escapeHtml(announcement.link)}">${escapeHtml(
              announcement.label || 'Learn more'
            )}</a>`
          : ''
      }
      <button class="announcement__close" type="button" aria-label="Dismiss announcement" data-announce-close>
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    </div>`;
  document.body.insertBefore(banner, document.body.firstChild);
  banner.querySelector('[data-announce-close]')?.addEventListener('click', () => {
    try {
      sessionStorage.setItem(key, signature);
    } catch {
      /* ignore */
    }
    banner.remove();
  });
  refreshIcons();
}

function applyFooter(footer) {
  if (!footer || typeof footer !== 'object') return;
  if (footer.intro) business.footerIntro = escapeHtml(footer.intro);
  if (footer.disclaimer) business.footerDisclaimer = escapeHtml(footer.disclaimer);
  const footerMount = document.querySelector('[data-site-footer]');
  if (footerMount) {
    footerMount.innerHTML = renderFooter();
    initCurrentYear();
    refreshIcons();
  }
}

function applySite(siteContent) {
  if (!siteContent || typeof siteContent !== 'object') return;
  if (siteContent.banksLastUpdated) site.banksLastUpdated = siteContent.banksLastUpdated;
}

/**
 * Fetch and apply public CMS data. Safe to call on every public page.
 */
export async function initCms() {
  if (location.pathname.includes('/admin')) return null;

  const params = new URLSearchParams(location.search);
  const force = params.get('cms_preview') === '1';
  let data = force ? null : readCache();
  if (!data) {
    data = await fetchPublicCms();
    if (data) writeCache(data);
  }
  if (!data) return null;

  const content = data.content || {};
  const cfg = await getConfig();

  applySite(content.site);
  applyHero(content.hero);
  applyContact(content.contact);
  applyAnnouncement(content.announcement);
  applyFooter(content.footer);

  const services = mergeServices(content.services);
  if (services) applyCmsContent({ services });

  const banks = await mapBanks(data.banks, data.rates, cfg);
  if (banks) applyCmsContent({ banks });

  document.documentElement.setAttribute('data-cms', 'live');
  window.dispatchEvent(new CustomEvent('cms:applied'));
  return data;
}
