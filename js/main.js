/**
 * Application entry point.
 * Renders the shared shell, hydrates data-driven sections, then starts the
 * behaviour modules. Everything is progressive-enhancement friendly: if a
 * module fails, the rest of the page remains usable.
 */
import { renderHeader, renderFooter } from "./components.js";
import {
  renderBanks,
  renderServices,
  renderTestimonials,
  renderFaqs,
  renderTrustHighlights,
  renderProcessHours,
  initContactActions,
  initImageFallbacks,
  initCurrentYear,
  initMapsFallback,
  injectBusinessMeta,
} from "./render.js";
import { initNavigation } from "./navigation.js";
import { initCalculator } from "./calculator.js";
import { initContactForm } from "./forms.js";
import { initAnimations } from "./animations.js";
import { initHero3D } from "./hero-3d.js";
import { trackEvent } from "./backend.js";
import { initCms } from "./cms.js";

const refreshIcons = () => {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
};

const mount = () => {
  const body = document.body;
  const page = body.dataset.page || "home";
  const activeKey = page === "legal" ? "" : page;

  const headerMount = document.querySelector("[data-site-header]");
  const footerMount = document.querySelector("[data-site-footer]");

  if (headerMount) headerMount.innerHTML = renderHeader(activeKey);
  if (footerMount) footerMount.innerHTML = renderFooter();

  refreshIcons();

  /* Data-driven sections */
  renderTrustHighlights();
  renderBanks();
  renderServices();
  renderTestimonials();
  renderFaqs();
  renderProcessHours();
  injectBusinessMeta();

  /* Behaviours */
  initNavigation();
  initCalculator();
  initContactForm();
  initContactActions();
  initImageFallbacks();
  initCurrentYear();
  initMapsFallback();

  /* Reveal choreography after all sections exist. */
  initAnimations();

  /* Premium 3D hero enhancement (progressive, reduced-motion/mobile safe). */
  initHero3D();

  /* Live CMS hydration (async). Static content stays as the fallback. */
  initCms().catch(() => {});

  // First-party analytics (privacy-conscious). No-ops if backend not configured.
  if (!location.pathname.includes('/admin')) {
    trackEvent('page_view', { title: document.title });
    try {
      const vk = localStorage.getItem('as_vk_day');
      const day = new Date().toISOString().slice(0,10);
      if (vk !== day) { localStorage.setItem('as_vk_day', day); trackEvent('unique_visit', { day }); }
    } catch {}
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a,button');
      if (!a) return;
      const href = (a.getAttribute('href')||'').toLowerCase();
      if (href.startsWith('tel:')) trackEvent('phone_click', { href });
      else if (href.includes('wa.me') || href.includes('whatsapp')) trackEvent('whatsapp_click', { href });
      else if (href.includes('mailto:') || href.includes('google.com/maps')) trackEvent('contact_click', { href });
      else if (a.matches('.btn--primary,[data-cta],.hero__actions .btn')) trackEvent('cta_click', { text: (a.textContent||'').trim().slice(0,60) });
    }, { capture:true, passive:true });
  }

  refreshIcons();
  window.dispatchEvent(new CustomEvent("ui:rendered"));

  /* Keep the header state correct when arriving with a hash link. */
  if (window.location.hash) {
    window.setTimeout(() => {
      document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth" });
    }, 260);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
