/**
 * Shared header and footer markup.
 * Keeping the shell in one place guarantees a consistent navigation experience
 * across every page and makes future migrations (e.g. to a CMS) simpler.
 */
import {
  business,
  site,
  navigationLinks,
  footerServices,
  legalLinks,
  financialDisclaimer,
} from "./data.js";

const icon = (name, className = "") =>
  `<i data-lucide="${name}" class="${className}" aria-hidden="true"></i>`;

export function renderHeader(activeKey = "") {
  const links = navigationLinks
    .map(
      (link) => `
        <li>
          <a class="nav-link${link.key === activeKey ? " is-active" : ""}"
             href="${link.href}"
             ${link.key === activeKey ? 'aria-current="page"' : ""}>${link.label}</a>
        </li>`
    )
    .join("");

  return `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header" data-header>
      <div class="container nav-shell">
        <a class="brand" href="index.html" aria-label="${business.name} — home">
          <span class="brand__mark" aria-hidden="true">AS</span>
          <span class="brand__type">
            <strong>AS Financial</strong>
            <span>Services &amp; Solutions</span>
          </span>
        </a>

        <nav class="primary-nav" aria-label="Primary">
          <ul>${links}</ul>
        </nav>

        <div class="nav-actions">
          <a class="btn btn--primary btn--sm nav-cta" href="contact.html?intent=apply">
            Apply Now ${icon("arrow-up-right")}
          </a>
          <button class="nav-toggle" type="button" aria-expanded="false"
                  aria-controls="mobile-drawer" aria-label="Open menu" data-nav-toggle>
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <div class="mobile-backdrop" data-mobile-backdrop hidden></div>
    <aside class="mobile-drawer" id="mobile-drawer" aria-hidden="true"
           aria-label="Mobile navigation" data-mobile-drawer>
      <div class="mobile-drawer__head">
        <a class="brand brand--dark" href="index.html" aria-label="${business.name} — home">
          <span class="brand__mark" aria-hidden="true">AS</span>
          <span class="brand__type">
            <strong>AS Financial</strong>
            <span>Services &amp; Solutions</span>
          </span>
        </a>
        <button class="icon-btn" type="button" aria-label="Close menu" data-nav-close>
          ${icon("x")}
        </button>
      </div>
      <nav class="mobile-nav" aria-label="Mobile primary">
        <ul>
          ${navigationLinks
            .map(
              (link) => `
              <li>
                <a href="${link.href}" class="${link.key === activeKey ? "is-active" : ""}">
                  <span>${link.label}</span>${icon("arrow-up-right")}
                </a>
              </li>`
            )
            .join("")}
        </ul>
      </nav>
      <div class="mobile-drawer__foot">
        <a class="btn btn--primary btn--block" href="contact.html?intent=apply">Apply Now ${icon("arrow-up-right")}</a>
        <p class="mobile-contact">
          ${icon("map-pin")} ${business.city}, ${business.region}
        </p>
        <a class="text-link" href="${business.mapUrl}" target="_blank" rel="noopener noreferrer">
          View Google Business Profile ${icon("arrow-up-right")}
        </a>
      </div>
    </aside>
  `;
}

export function renderFooter() {
  const contactItems = [
    {
      action: "call",
      icon: "phone",
      label: business.phone.display,
      href: `tel:${business.phone.tel}`,
      verified: business.phone.verified,
    },
    {
      action: "whatsapp",
      icon: "message-circle",
      label: "WhatsApp",
      href: `https://wa.me/${business.whatsapp.number}`,
      verified: business.whatsapp.verified,
    },
    {
      action: "email",
      icon: "mail",
      label: business.email.display,
      href: `mailto:${business.email.address}`,
      verified: business.email.verified,
    },
  ];

  const contactMarkup = contactItems
    .map(
      (item) => `
        <li>
          <a class="footer-contact__link" href="${item.href}"
             ${item.action === "whatsapp" ? 'target="_blank" rel="noopener noreferrer"' : ""}
             data-contact="${item.action}" ${item.verified ? "" : 'data-unverified="true"'}>
            ${icon(item.icon)}<span>${item.label}</span>
            ${item.verified ? "" : '<span class="sr-only"> (contact detail to be confirmed)</span>'}
          </a>
          ${item.verified ? "" : `<div class="footer-contact__note">Contact detail to be confirmed</div>`}
        </li>`
    )
    .join("");

  return `
    <div class="mobile-sticky-cta" data-mobile-sticky-cta>
      <a class="btn btn--ghost btn--sm" href="tel:${business.phone.tel}" aria-label="Call ${business.phone.display}">${icon("phone")} Call</a>
      <a class="btn btn--ghost btn--sm" href="https://wa.me/${business.whatsapp.number}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${icon("message-circle")} WhatsApp</a>
      <a class="btn btn--primary btn--sm" href="contact.html#enquiry" aria-label="Send enquiry">${icon("send")} Enquire</a>
    </div>
    <footer class="site-footer">
      <div class="footer-glow" aria-hidden="true"></div>
      <div class="container footer-grid">
        <div class="footer-brand">
          <a class="brand brand--light" href="index.html" aria-label="${business.name} — home">
            <span class="brand__mark" aria-hidden="true">AS</span>
            <span class="brand__type">
              <strong>AS Financial</strong>
              <span>Services &amp; Solutions</span>
            </span>
          </a>
          <p class="footer-intro">
            ${
              business.footerIntro ||
              `${business.slogan || business.tagline}. Clear guidance for loans, mortgage needs, private funds, project funding and insurance enquiries.`
            }
          </p>
          <p class="footer-location">${icon("map-pin")} ${business.addressLine || `${business.city}, ${business.region}`}</p>
          <a class="footer-map-link" href="${business.mapUrl}" target="_blank" rel="noopener noreferrer">
            Get directions ${icon("arrow-up-right")}
          </a>
        </div>

        <div class="footer-col">
          <h3>Explore</h3>
          <ul>
            ${navigationLinks
              .map(
                (link) =>
                  `<li><a href="${link.href}">${link.label}</a></li>`
              )
              .join("")}
          </ul>
        </div>

        <div class="footer-col">
          <h3>Services</h3>
          <ul>
            ${footerServices
              .map(
                (link) =>
                  `<li><a href="${link.href}">${link.label}</a></li>`
              )
              .join("")}
          </ul>
        </div>

        <div class="footer-col footer-contact">
          <h3>Talk to us</h3>
          <ul>${contactMarkup}</ul>
          <p class="footer-hours">${business.hours}<br><span>${business.hoursNote}</span></p>
          <a class="footer-map-link" href="${business.mapUrl}" target="_blank" rel="noopener noreferrer">
            ${icon("navigation")} Get directions ${icon("arrow-up-right")}
          </a>
        </div>
      </div>

      <div class="container footer-legal">
        <p class="footer-disclaimer">${business.footerDisclaimer || financialDisclaimer}</p>
        <div class="footer-legal__row">
          <p>&copy; <span data-current-year>2026</span> ${business.name}. All rights reserved.</p>
          <ul class="legal-links">
            ${legalLinks
              .map(
                (link) =>
                  `<li><a href="${link.href}">${link.label}</a></li>`
              )
              .join("")}
            <li><a href="admin/login.html" class="footer-admin-link">Admin</a></li>
          </ul>
        </div>
        <p class="footer-updated">
          Lender information shown on this website is indicative for comparison only and was last reviewed on ${site.banksLastUpdated}. Please confirm current rates, fees and eligibility directly with the lender.
        </p>
      </div>
    </footer>
  `;
}

export function renderPageHero({ eyebrow, title, lede, crumbs = [], tone = "ivory" }) {
  return `
    <section class="page-hero page-hero--${tone}">
      <div class="page-hero__shape page-hero__shape--one" aria-hidden="true"></div>
      <div class="page-hero__shape page-hero__shape--two" aria-hidden="true"></div>
      <div class="container">
        ${
          crumbs.length
            ? `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs
                .map(
                  (crumb, index) =>
                    index === crumbs.length - 1
                      ? `<li aria-current="page">${crumb.label}</li>`
                      : `<li><a href="${crumb.href}">${crumb.label}</a></li>`
                )
                .join("")}</ol></nav>`
            : ""
        }
        <div class="page-hero__inner" data-reveal>
          ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
          <h1>${title}</h1>
          ${lede ? `<p class="page-hero__lede">${lede}</p>` : ""}
        </div>
      </div>
    </section>
  `;
}
