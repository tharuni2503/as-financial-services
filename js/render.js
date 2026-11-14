/**
 * Data-driven rendering for banks, services, reviews and FAQs.
 * Keeping these sections out of the HTML means future CMS / Supabase data can
 * replace the local arrays without touching page templates.
 */
import {
  banks as staticBanks,
  services as staticServices,
  verifiedReviews,
  testimonialPlaceholders,
  faqs,
  business,
  site,
  trustHighlights,
} from "./data.js";

/**
 * Mutable content used by the renderers. The public CMS hydrates these after
 * first paint so the static site is always the safe fallback.
 */
let activeBanks = staticBanks;
let activeServices = staticServices;

export function applyCmsContent({ banks, services } = {}) {
  if (Array.isArray(banks) && banks.length) activeBanks = banks;
  if (Array.isArray(services) && services.length) activeServices = services;
  if (Array.isArray(banks)) renderBanks();
  if (Array.isArray(services)) renderServices();
}

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const icon = (name, cls = "") =>
  `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;

const refreshIcons = () => {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
};

/* ------------------------------------------------------------------ banks */

function bankLogo(bank) {
  const label = escapeHtml(bank.name);
  const wordmark = escapeHtml(bank.wordmark || bank.shortName || bank.name);
  if (bank.logo) {
    return `<span class="bank-card__logo bank-card__logo--img"><img src="${escapeHtml(bank.logo)}" alt="${label} logo" loading="lazy" width="120" height="44" onerror="this.closest('.bank-card__logo').classList.remove('bank-card__logo--img');this.closest('.bank-card__logo').innerHTML='<span class=\\'bank-card__wordmark\\'>${wordmark.replace(/'/g, '&#39;')}</span>'"></span>`;
  }
  return `<span class="bank-card__logo" aria-hidden="true"><span class="bank-card__wordmark">${wordmark}</span></span>`;
}

function bankCard(bank) {
  const href = `contact.html?service=Home+Loan&bank=${encodeURIComponent(bank.name)}`;
  const emi = bank.emiPerLakh || "—";
  const tenure = bank.tenure || "Varies by lender";
  const updated = bank.updated || site.banksLastUpdated;
  return `
    <article class="bank-card bank-card--premium" data-bank-card data-type="${escapeHtml(bank.type)}">
      <div class="bank-card__top">
        ${bankLogo(bank)}
        <span class="bank-type">${escapeHtml(bank.type)}</span>
      </div>
      <h3 class="bank-name">${escapeHtml(bank.name)}</h3>
      <div class="bank-rate">
        <strong>${escapeHtml(bank.rate)}%</strong>
        <span>p.a.*</span>
      </div>
      <p class="bank-rate-note">Indicative sample rate — not a lender offer</p>
      <dl class="bank-meta bank-meta--rich">
        <div><dt>Loan amount</dt><dd>${escapeHtml(bank.amountRange)}</dd></div>
        <div><dt>EMI per lakh*</dt><dd>${escapeHtml(emi)}</dd></div>
        <div><dt>Processing fee</dt><dd>${escapeHtml(bank.processingFee)}</dd></div>
        <div><dt>Loan tenure</dt><dd>${escapeHtml(tenure)}</dd></div>
      </dl>
      <p class="bank-updated">${icon("calendar-check")} Updated ${escapeHtml(updated)}</p>
      <div class="bank-card__actions">
        <a class="btn btn--ghost" href="${href}">Explore offer ${icon("arrow-up-right")}</a>
        <a class="btn btn--primary" href="contact.html?service=Home+Loan&bank=${encodeURIComponent(bank.name)}">Enquire ${icon("message-circle")}</a>
      </div>
    </article>
  `;
}

export function renderBankShowcase() {
  const roots = document.querySelectorAll("[data-bank-showcase]");
  if (!roots.length) return;
  const items = activeBanks.map((bank) => {
    const wordmark = escapeHtml(bank.wordmark || bank.shortName || bank.name);
    const mark = bank.logo
      ? `<span class="bank-showcase__logo bank-showcase__logo--img"><img src="${escapeHtml(bank.logo)}" alt="${escapeHtml(bank.name)} logo" loading="lazy" onerror="this.closest('.bank-showcase__logo').classList.remove('bank-showcase__logo--img');this.outerHTML='<span class=\\'bank-showcase__wordmark\\'>${wordmark.replace(/'/g, '&#39;')}</span>'"></span>`
      : `<span class="bank-showcase__logo"><span class="bank-showcase__wordmark">${wordmark}</span></span>`;
    return `<div class="bank-showcase__item" aria-label="${escapeHtml(bank.name)}">${mark}<span class="bank-showcase__name">${escapeHtml(bank.name)}</span></div>`;
  }).join("");
  roots.forEach((root) => {
    root.innerHTML = `<div class="bank-showcase" aria-label="Lender comparison showcase, illustrative samples only"><div class="bank-showcase__track">${items}${items}</div></div>`;
  });
}

export function renderBanks() {
  renderBankShowcase();
  const grids = document.querySelectorAll("[data-bank-grid]");
  grids.forEach((grid) => {
    const limitAttr = grid.getAttribute("data-limit");
    const limit = limitAttr === "all" ? activeBanks.length : Number(limitAttr) || activeBanks.length;
    const moreButton = document.querySelector("[data-bank-more]");
    const countEl = document.querySelector("[data-bank-count]");

    const paint = (activeType = "All") => {
      const filtered = activeBanks.filter(
        (bank) => activeType === "All" || bank.type === activeType
      );
      grid.innerHTML = filtered.map(bankCard).join("");

      const cards = Array.from(grid.querySelectorAll("[data-bank-card]"));
      if (limit < filtered.length) {
        cards.forEach((card, index) => {
          if (index >= limit) card.hidden = true;
        });
      } else {
        cards.forEach((card) => (card.hidden = false));
      }

      if (moreButton) {
        const hasExtra = cards.length > limit;
        moreButton.hidden = !hasExtra;
        if (!hasExtra) moreButton.setAttribute("aria-expanded", "false");
      }

      if (countEl) {
        countEl.textContent = `${filtered.length} lender${filtered.length === 1 ? "" : "s"} shown`;
      }

      refreshIcons();
    };

    paint();

    if (moreButton && limit < activeBanks.length && !moreButton.dataset.bound) {
      moreButton.dataset.bound = "true";
      moreButton.addEventListener("click", () => {
        const expanded = moreButton.getAttribute("aria-expanded") === "true";
        Array.from(grid.querySelectorAll("[data-bank-card]")).forEach((card, index) => {
          if (index >= limit) card.hidden = expanded;
        });
        moreButton.setAttribute("aria-expanded", String(!expanded));
        moreButton.innerHTML = expanded
          ? `Show all ${activeBanks.length} banks ${icon("chevron-down")}`
          : `Show less ${icon("chevron-down")}`;
        refreshIcons();
      });
    }
    if (moreButton && limit < activeBanks.length) {
      moreButton.innerHTML = `Show all ${activeBanks.length} banks ${icon("chevron-down")}`;
    }

    const filterWrap = document.querySelector("[data-bank-filters]");
    if (filterWrap && !filterWrap.dataset.bound) {
      filterWrap.dataset.bound = "true";
      filterWrap.addEventListener("click", (event) => {
        const button = event.target.closest("[data-bank-filter]");
        if (!button) return;
        filterWrap.querySelectorAll("[data-bank-filter]").forEach((tab) => {
          tab.classList.toggle("is-active", tab === button);
          tab.setAttribute("aria-pressed", String(tab === button));
        });
        paint(button.getAttribute("data-bank-filter"));
      });
    }
  });
}

/* --------------------------------------------------------------- services */

function serviceCard(service, index) {
  return `
    <article class="service-card" data-service-card data-service-index="${index}" data-tone="${escapeHtml(service.tone || "amber")}">
      <div class="service-card__media img-shell">
        <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.alt)}" loading="lazy" width="1500" height="1000">
        <span class="service-card__index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
        <span class="service-card__tag">${escapeHtml(service.tag)}</span>
      </div>
      <div class="service-card__body">
        <span class="service-card__icon">${icon(service.icon)}</span>
        <h3>${escapeHtml(service.title)}</h3>
        <p>${escapeHtml(service.description)}</p>
        <div class="service-card__foot">
          <button class="text-link" type="button" data-service-open="${escapeHtml(service.id)}">
            Learn More ${icon("arrow-up-right")}
          </button>
          <a class="service-card__enquire" href="${escapeHtml(service.cta.href)}">
            Enquire ${icon("arrow-up-right")}
          </a>
        </div>
      </div>
    </article>
  `;
}

export function renderServices() {
  const grid = document.querySelector("[data-service-grid]");
  if (!grid) return;
  const limitAttr = grid.getAttribute("data-limit");
  const moreButton = document.querySelector("[data-service-more]");

  const paint = () => {
    const limit = limitAttr === "all" ? activeServices.length : Number(limitAttr) || 3;
    const expanded = grid.dataset.expanded === "true";
    grid.innerHTML = activeServices.map(serviceCard).join("");
    Array.from(grid.querySelectorAll("[data-service-card]")).forEach((card, index) => {
      if (!expanded && index >= limit) card.hidden = true;
    });
    if (moreButton) {
      moreButton.hidden = activeServices.length <= limit;
      moreButton.innerHTML = expanded
        ? `Show fewer services ${icon("chevron-down")}`
        : `Show all services ${icon("chevron-down")}`;
      moreButton.setAttribute("aria-expanded", String(expanded));
    }
    refreshIcons();
  };

  paint();

  if (moreButton && !moreButton.dataset.bound) {
    moreButton.dataset.bound = "true";
    moreButton.addEventListener("click", () => {
      grid.dataset.expanded = grid.dataset.expanded === "true" ? "false" : "true";
      paint();
      if (grid.dataset.expanded !== "true") {
        document.querySelector("[data-services]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (!grid.dataset.bound) {
    grid.dataset.bound = "true";
    const modal = ensureServiceModal();
    grid.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-service-open]");
      if (!trigger) return;
      const service = activeServices.find((item) => item.id === trigger.getAttribute("data-service-open"));
      if (!service) return;
      openServiceModal(modal, service, trigger);
    });
  }
}

function ensureServiceModal() {
  let modal = document.querySelector("[data-service-modal]");
  if (modal) return modal;

  modal = document.createElement("dialog");
  modal.className = "service-modal";
  modal.setAttribute("data-service-modal", "");
  modal.innerHTML = `
    <div class="service-modal__media img-shell">
      <img src="" alt="" data-modal-image>
      <button class="icon-btn service-modal__close" type="button" aria-label="Close service details" data-modal-close>
        ${icon("x")}
      </button>
    </div>
    <div class="service-modal__body">
      <p class="eyebrow" data-modal-tag></p>
      <h2 data-modal-title></h2>
      <p data-modal-description></p>
      <ul class="service-modal__list" data-modal-list></ul>
      <div class="service-modal__actions">
        <a class="btn btn--primary" data-modal-cta href="contact.html">
          Talk to an expert ${icon("arrow-up-right")}
        </a>
        <button class="btn btn--ghost" type="button" data-modal-close>Close</button>
      </div>
      <p class="form-note" style="margin-top:18px">Service availability, eligibility and final terms are determined by the lender.</p>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
    if (event.target.closest("[data-modal-close]")) modal.close();
  });

  refreshIcons();
  return modal;
}

function openServiceModal(modal, service, trigger) {
  modal.querySelector("[data-modal-image]").src = service.image;
  modal.querySelector("[data-modal-image]").alt = service.alt;
  modal.querySelector("[data-modal-tag]").textContent = service.tag;
  modal.querySelector("[data-modal-title]").textContent = service.title;
  modal.querySelector("[data-modal-description]").textContent = service.description;
  modal.querySelector("[data-modal-list]").innerHTML = service.details
    .map((item) => `<li>${icon("check")}<span>${escapeHtml(item)}</span></li>`)
    .join("");
  const cta = modal.querySelector("[data-modal-cta]");
  cta.href = service.cta.href;
  cta.innerHTML = `${escapeHtml(service.cta.label)} ${icon("arrow-up-right")}`;
  modal.dataset.triggerId = service.id;
  refreshIcons();
  modal.showModal();

  modal.addEventListener(
    "close",
    () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    },
    { once: true }
  );
}

/* ------------------------------------------------------------ testimonials */

function reviewSlide(review, index) {
  const content = `
    <div class="carousel__slide" role="group" aria-roledescription="slide" aria-label="Review ${index + 1}">
      <article class="review-card">
        <span class="review-card__quote">${icon("quote")}</span>
        <p class="review-card__category">${escapeHtml(review.category || "Client review")}</p>
        <blockquote>"${escapeHtml(review.quote)}"</blockquote>
        <div class="review-card__meta">
          <span class="review-card__verified">
            ${icon("badge-check")}
            ${escapeHtml(review.name || "Verified customer")}${review.city ? ` · ${escapeHtml(review.city)}` : ""}
          </span>
          <span>${escapeHtml(review.source || "Google")}${review.date ? ` · ${escapeHtml(review.date)}` : ""}</span>
        </div>
      </article>
    </div>
  `;
  return content;
}

export function renderTestimonials() {
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  // Only verified reviews are shown publicly. If none, hide the carousel
  // (the page keeps a verified Google Maps link/note for genuine feedback).
  const reviews = Array.isArray(verifiedReviews) ? verifiedReviews : [];
  if (!reviews.length) {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    return;
  }

  root.hidden = false;
  root.removeAttribute("aria-hidden");
  const track = root.querySelector("[data-carousel-track]");
  const dotsWrap = root.querySelector("[data-carousel-dots]");
  const live = root.querySelector("[data-carousel-live]");

  track.innerHTML = reviews.map(reviewSlide).join("");
  dotsWrap.innerHTML = reviews
    .map(
      (_, index) =>
        `<button class="carousel__dot${index === 0 ? " is-active" : ""}" type="button"
          data-carousel-dot="${index}" aria-label="Go to review ${index + 1}"
          aria-current="${index === 0 ? "true" : "false"}"></button>`
    )
    .join("");

  let index = 0;

  const go = (nextIndex, announce = true) => {
    index = (nextIndex + reviews.length) % reviews.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    Array.from(track.children).forEach((slide, slideIndex) => {
      slide.setAttribute("aria-hidden", String(slideIndex !== index));
    });
    dotsWrap.querySelectorAll("[data-carousel-dot]").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
      dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
    });
    if (live && announce) {
      live.textContent = `Review ${index + 1} of ${reviews.length}`;
    }
  };

  go(0, false);

  root.querySelectorAll("[data-carousel-prev]").forEach((button) =>
    button.addEventListener("click", () => go(index - 1))
  );
  root.querySelectorAll("[data-carousel-next]").forEach((button) =>
    button.addEventListener("click", () => go(index + 1))
  );
  dotsWrap.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-carousel-dot]");
    if (dot) go(Number(dot.getAttribute("data-carousel-dot")));
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    }
  });

  /* Lightweight swipe support. */
  let startX = null;
  const viewport = root.querySelector(".carousel__viewport");
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      startX = event.clientX;
    },
    { passive: true }
  );
  viewport.addEventListener(
    "pointerup",
    (event) => {
      if (startX === null) return;
      const diff = event.clientX - startX;
      if (Math.abs(diff) > 45) go(index + (diff < 0 ? 1 : -1));
      startX = null;
    },
    { passive: true }
  );

  refreshIcons();
}

/* -------------------------------------------------------------------- FAQ */

export function renderFaqs() {
  const list = document.querySelector("[data-faq-list]");
  if (!list) return;
  list.innerHTML = faqs
    .map(
      (faq, index) => `
        <details class="faq-item" ${index === 0 ? "open" : ""}>
          <summary>${escapeHtml(faq.q)}</summary>
          <div class="faq-item__answer">${escapeHtml(faq.a)}</div>
        </details>
      `
    )
    .join("");

  const enforceSingleOpen = (opened) => {
    if (!(opened instanceof HTMLDetailsElement) || !opened.open) return;
    list.querySelectorAll("details.faq-item[open]").forEach((item) => {
      if (item !== opened) item.open = false;
    });
  };

  list.addEventListener("toggle", (event) => {
    enforceSingleOpen(event.target);
  });

  list.addEventListener("click", (event) => {
    const summary = event.target.closest("summary");
    if (!summary) return;
    const details = summary.parentElement;
    window.requestAnimationFrame(() => enforceSingleOpen(details));
  });
}

/* --------------------------------------------------------- shared content */

export function renderProcessHours() {
  document.querySelectorAll("[data-process-hours]").forEach((el) => {
    if (site.processHours != null) {
      el.textContent = site.processHours;
    } else {
      // No fixed-time promise: clear/hide the badge if no indicative value is set.
      el.textContent = "";
      const badge = el.closest(".process-badge, .hero-stat");
      if (badge) badge.hidden = true;
    }
  });
}

export function renderTrustHighlights() {
  const wrap = document.querySelector("[data-trust-highlights]");
  if (!wrap) return;
  wrap.innerHTML = trustHighlights
    .map(
      (item) => `
        <div class="trust-item">
          <span class="trust-item__icon tone-${escapeHtml(item.tone)}">${icon(item.icon)}</span>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </div>
      `
    )
    .join("");
  refreshIcons();
}

/* ---------------------------------------------------------- contact links */

export function showToast(message, type = "info") {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `${icon(type === "error" ? "alert-circle" : "info")}<span>${escapeHtml(message)}</span>`;
  region.appendChild(toast);
  refreshIcons();

  const remove = () => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 320);
  };
  const timer = window.setTimeout(remove, 6500);
  toast.addEventListener("click", () => {
    window.clearTimeout(timer);
    remove();
  });
}

export function initContactActions() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-contact][data-unverified='true']");
    if (!link) return;
    event.preventDefault();
    const type = link.getAttribute("data-contact");
    const label =
      type === "call"
        ? "The phone number"
        : type === "whatsapp"
          ? "The WhatsApp number"
          : "The email address";
    showToast(
      `${label} is being confirmed. Please use the verified contact options shown on this page or try again shortly.`
    );
  });
}

export function initImageFallbacks() {
  const fallback = "assets/images/fallback.svg";

  const apply = (img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "true";
    img.classList.add("image-fallback");
    img.src = fallback;
    img.alt = img.alt || "AS Financial Services and Solutions";
  };

  document.addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLImageElement) apply(event.target);
    },
    true
  );

  document.querySelectorAll("img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) apply(img);
  });
}

export function initCurrentYear() {
  document.querySelectorAll("[data-current-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

export function initMapsFallback() {
  const frame = document.querySelector("[data-map-frame]");
  if (!frame) return;
  frame.addEventListener("error", () => {
    const panel = frame.closest(".map-panel");
    if (panel) panel.classList.add("map-panel--unavailable");
  });
}

export function injectBusinessMeta() {
  document.querySelectorAll("[data-business-name]").forEach((el) => {
    el.textContent = business.name;
  });
  document.querySelectorAll("[data-business-city]").forEach((el) => {
    el.textContent = `${business.city}, ${business.region}`;
  });
}
