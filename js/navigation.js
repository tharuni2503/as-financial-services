/**
 * Accessible navigation behaviour: sticky header state and mobile drawer.
 */
export function initNavigation() {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const drawer = document.querySelector("[data-mobile-drawer]");
  const backdrop = document.querySelector("[data-mobile-backdrop]");
  const closeBtn = document.querySelector("[data-nav-close]");

  if (!header) return;

  /* -------------------------------------------------------------- header */
  let ticking = false;
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 14);
    ticking = false;
  };

  updateHeader();
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    },
    { passive: true }
  );

  if (!toggle || !drawer) return;

  /* -------------------------------------------------------------- drawer */
  let lastFocused = null;
  const focusableSelector =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const isOpen = () => drawer.classList.contains("is-open");

  const openDrawer = () => {
    lastFocused = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add("is-locked");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    window.requestAnimationFrame(() => backdrop.classList.add("is-visible"));
    const firstLink = drawer.querySelector(focusableSelector);
    if (firstLink) window.setTimeout(() => firstLink.focus(), 120);
  };

  const closeDrawer = ({ restoreFocus = true } = {}) => {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("is-locked");
    window.setTimeout(() => {
      backdrop.hidden = true;
    }, 380);
    if (restoreFocus && lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  };

  toggle.addEventListener("click", () => {
    if (isOpen()) closeDrawer();
    else openDrawer();
  });

  if (closeBtn) closeBtn.addEventListener("click", () => closeDrawer());
  if (backdrop) backdrop.addEventListener("click", () => closeDrawer());

  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeDrawer({ restoreFocus: false }));
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(drawer.querySelectorAll(focusableSelector)).filter(
      (el) => el.offsetParent !== null
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180 && isOpen()) {
      closeDrawer({ restoreFocus: false });
    }
  });

  /* Close the drawer if the viewport is restored from the back/forward cache. */
  window.addEventListener("pageshow", () => {
    if (isOpen()) closeDrawer({ restoreFocus: false });
  });
}
