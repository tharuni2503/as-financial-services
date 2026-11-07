/**
 * Scroll choreography (v2).
 *
 * Storytelling rules used throughout the site:
 *  - Headings and intro columns arrive with directional slides, never the
 *    same fade-up twice in a row.
 *  - Card groups stagger with their own seasoning: services scale softly,
 *    challenge rows slide in from the left, banks pop, why-cards lift.
 *  - Media and photos can use a clip-path "wipe" via data-reveal="mask".
 *  - The hero exits with a damped parallax drift that hands the eye over to
 *    the next section; the footer gets its own entrance beat.
 *
 * No pinning and no scroll hijacking: everything is trigger-based or scrubbed
 * transforms, reversible in both directions, and fully disabled when
 * prefers-reduced-motion is set (or when GSAP fails to load).
 */
export function initAnimations() {
  const html = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealAll = () => {
    document
      .querySelectorAll(
        "[data-reveal], [data-hero-photo], [data-hero-item], [data-hero-line], [data-hero-visual], [data-hero-stats]"
      )
      .forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.clipPath = "none";
        el.classList.add("is-revealed");
      });
    document.querySelectorAll("[data-count]").forEach((el) => {
      if (!el.textContent.trim()) el.textContent = el.getAttribute("data-count") || "0";
    });
    document.querySelectorAll("[data-hero-line] > span").forEach((el) => {
      el.style.transform = "none";
    });
    const track = document.querySelector(".process-track");
    if (track && !track.querySelector(".process-progress")) {
      const line = document.createElement("div");
      line.className = "process-progress";
      line.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "process-progress__fill";
      fill.style.transform = "scaleX(1)";
      line.appendChild(fill);
      track.prepend(line);
    }
    document.querySelectorAll(".process-step").forEach((s) => s.classList.add("is-active"));
    document.querySelectorAll("[data-benefit-panel]").forEach((p, i) =>
      p.classList.toggle("is-active", i === 0)
    );
  };

  const { gsap, ScrollTrigger } = window;
  if (reduced || !gsap || !ScrollTrigger) {
    revealAll();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* -------------------------------------------------------- hidden states */
  gsap.utils.toArray("[data-hero-line] > span").forEach((el) => gsap.set(el, { yPercent: 112 }));
  gsap.utils.toArray("[data-hero-stats]").forEach((el) => gsap.set(el, { opacity: 0, y: 18 }));

  /* ------------------------------------------------------ scroll progress */
  const header = document.querySelector("[data-header]");
  if (header && !header.querySelector(".scroll-progress")) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = '<span class="scroll-progress__fill"></span>';
    header.appendChild(bar);
    const fill = bar.querySelector(".scroll-progress__fill");
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.transform = `scaleX(${p})`;
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }

  /* ---------------------------------------------------------- hero intro */
  const heroLines = gsap.utils.toArray("[data-hero-line] > span");
  const heroItems = gsap.utils.toArray("[data-hero-item]");
  const heroVisual = document.querySelector("[data-hero-visual]");
  const heroPhoto = document.querySelector("[data-hero-photo]");
  const heroFloats = gsap.utils.toArray("[data-hero-float]");
  const heroStats = gsap.utils.toArray("[data-hero-stats]");

  const intro = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.14 });

  if (heroLines.length) {
    intro.fromTo(
      heroLines,
      { yPercent: 112 },
      { yPercent: 0, duration: 1.2, stagger: 0.13, ease: "expo.out" },
      0
    );
  }
  if (heroItems.length) {
    intro.fromTo(
      heroItems,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.85, stagger: 0.07 },
      0.26
    );
  }
  if (heroVisual) {
    intro.fromTo(
      heroVisual,
      { opacity: 0, y: 30, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 1.25, ease: "power2.out" },
      0.22
    );
  }
  if (heroPhoto) {
    intro.add(() => heroPhoto.classList.add("is-revealed"), 0.36);
  }
  if (heroFloats.length) {
    intro.fromTo(
      heroFloats,
      { opacity: 0, y: 16, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: 0.75, stagger: 0.13, ease: "back.out(1.6)" },
      0.9
    );
    // Hand ambient float over to CSS only after the intro settles.
    intro.add(() => html.classList.add("floats-live"), 1.7);
  }
  if (heroStats.length) {
    intro.to(heroStats, { opacity: 1, y: 0, duration: 0.95, ease: "power2.out" }, 1.0);
  }

  /* ------------------------------------------------------- scroll reveals */
  // Directional variants keep the page from feeling like one repeated fade.
  const revealFlavours = {
    default: { from: { opacity: 0, y: 30 }, ease: "power3.out", duration: 0.9 },
    left: { from: { opacity: 0, x: -36 }, ease: "power3.out", duration: 1.0 },
    right: { from: { opacity: 0, x: 36 }, ease: "power3.out", duration: 1.0 },
    mask: {
      from: { opacity: 0, clipPath: "inset(0% 0% 100% 0%)" },
      to: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
      ease: "power2.inOut",
      duration: 1.15,
    },
    scale: { from: { opacity: 0, scale: 0.94, y: 20 }, ease: "power2.out", duration: 1.0 },
  };

  const flavourFor = (el) => {
    const attr = el.getAttribute("data-reveal");
    if (attr && revealFlavours[attr]) return revealFlavours[attr];
    // Semantic assignments so the templates do not need extra attributes.
    if (el.classList.contains("challenges-intro")) return revealFlavours.left;
    if (el.classList.contains("review-note")) return revealFlavours.left;
    if (el.classList.contains("contact-aside")) return revealFlavours.right;
    if (el.classList.contains("split__media")) return revealFlavours.mask;
    if (el.classList.contains("final-cta")) return revealFlavours.scale;
    return revealFlavours.default;
  };

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    const flavour = flavourFor(el);
    gsap.fromTo(
      el,
      flavour.from,
      {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: flavour.duration,
        ease: flavour.ease,
        onStart: () => el.classList.add("is-revealed"),
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
  });

  /* ------------------------------------------------------- group staggers */
  const staggerGroups = [
    {
      parent: "[data-service-grid]",
      items: "[data-service-card]",
      from: { opacity: 0, y: 34, scale: 0.97 },
      each: 0.05,
      ease: "power3.out",
    },
    {
      parent: ".challenge-list",
      items: ".challenge-row",
      from: { opacity: 0, x: -32 },
      each: 0.12,
      ease: "power3.out",
    },
    {
      parent: ".intro-grid, .guide-grid",
      items: ".guide-card",
      from: { opacity: 0, y: 26 },
      each: 0.08,
      ease: "power2.out",
    },
    {
      parent: "[data-bank-grid]",
      items: "[data-bank-card]",
      from: { opacity: 0, y: 18, scale: 0.96 },
      each: 0.04,
      ease: "power2.out",
    },
    {
      parent: ".why-grid",
      items: ".why-card",
      from: { opacity: 0, y: 30 },
      each: 0.09,
      ease: "power3.out",
    },
    {
      parent: ".info-card-grid",
      items: ".info-card",
      from: { opacity: 0, y: 24 },
      each: 0.07,
      ease: "power2.out",
    },
    {
      parent: ".faq-list",
      items: ".faq-item",
      from: { opacity: 0, y: 20 },
      each: 0.06,
      ease: "power2.out",
    },
  ];

  staggerGroups.forEach(({ parent, items, from, each, ease }) => {
    document.querySelectorAll(parent).forEach((group) => {
      const children = Array.from(group.querySelectorAll(items)).filter((el) => !el.hidden);
      if (children.length < 2) return;
      // Challenge rows stagger from the bottom step upward for a countdown feel.
      const direction = group.classList.contains("challenge-list") ? "end" : "start";
      gsap.fromTo(
        children,
        from,
        {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          duration: 0.8,
          stagger: { each, from: direction },
          ease,
          scrollTrigger: { trigger: group, start: "top 85%", once: true },
        }
      );
    });
  });

  /* ---------------------------------------------------------- count-ups */
  gsap.utils.toArray("[data-count]").forEach((el) => {
    const end = Number(el.getAttribute("data-count")) || 0;
    const state = { value: 0 };
    el.textContent = "0";
    const run = () =>
      gsap.to(state, {
        value: end,
        duration: 1.45,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = String(Math.round(state.value));
        },
        onComplete: () => {
          el.textContent = String(end);
        },
      });
    const inHero = Boolean(el.closest(".hero, .hero--cinematic"));
    const rect = el.getBoundingClientRect();
    if (inHero || (rect.top < window.innerHeight * 1.05 && rect.bottom > 0)) {
      // Above-fold / hero counts: start promptly so they read correctly on load.
      gsap.delayedCall(inHero ? 0.25 : 0.1, run);
      gsap.delayedCall(inHero ? 1.7 : 1.6, () => { el.textContent = String(end); });
    } else {
      ScrollTrigger.create({ trigger: el, start: "top bottom", once: true, onEnter: run });
    }
  });

  /* ------------------------------------------------------------ parallax */
  gsap.utils.toArray("[data-parallax]").forEach((el) => {
    const strength = Number(el.getAttribute("data-parallax")) || 6;
    gsap.to(el, {
      yPercent: strength,
      ease: "none",
      scrollTrigger: {
        trigger: el.parentElement || el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  });

  /* --------------------------------------------- hero → next section handoff */
  if (heroLines.length) {
    const heroSection = document.querySelector(".hero--cinematic") || document.querySelector(".hero");
    if (heroSection) {
      const copy = heroSection.querySelector(".hero__copy");
      const stats = heroSection.querySelector("[data-hero-stats]");
      if (copy) {
        gsap.to(copy, {
          yPercent: -7,
          opacity: 0.55,
          ease: "none",
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: "bottom 35%",
            scrub: 0.6,
          },
        });
      }
      if (stats) {
        gsap.to(stats, {
          yPercent: 24,
          opacity: 0.4,
          ease: "none",
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      }
      const photo = heroSection.querySelector(".hero-photo");
      if (photo) {
        gsap.to(photo, {
          yPercent: 6,
          scale: 1.02,
          ease: "none",
          scrollTrigger: { trigger: heroSection, start: "top top", end: "bottom 35%", scrub: 0.6 },
        });
      }
      const plan = heroSection.querySelector(".hero-plan");
      if (plan) {
        gsap.to(plan, { y: -34, ease: "none", scrollTrigger: { trigger: heroSection, start: "top top", end: "bottom top", scrub: 0.8 } });
      }
    }
  }

  /* ----------------------------------------------------- hero mouse motion */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hero = document.querySelector(".hero--cinematic") || document.querySelector(".hero");
  if (hero && finePointer) {
    const photo = hero.querySelector(".hero-photo");
    const floats = gsap.utils.toArray(hero.querySelectorAll("[data-hero-float]"));
    if (photo) gsap.set(photo, { transformPerspective: 900 });
    const setPhotoX = photo ? gsap.quickTo(photo, "x", { duration: 0.7, ease: "power3.out" }) : null;
    const setPhotoY = photo ? gsap.quickTo(photo, "y", { duration: 0.7, ease: "power3.out" }) : null;
    const setPhotoRot = photo ? gsap.quickTo(photo, "rotationY", { duration: 0.9, ease: "power3.out" }) : null;
    const floatSetters = floats.map((el) => ({
      x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
      y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
      depth: Number(el.dataset.depth || 1),
    }));

    hero.addEventListener(
      "pointermove",
      (event) => {
        const rect = hero.getBoundingClientRect();
        const mx = (event.clientX - rect.left) / rect.width - 0.5;
        const my = (event.clientY - rect.top) / rect.height - 0.5;
        setPhotoX?.(mx * 14);
        setPhotoY?.(my * 10);
        setPhotoRot?.(mx * -3.2);
        floatSetters.forEach((s, i) => {
          const dir = i % 2 === 0 ? -1 : 1;
          s.x(mx * 22 * s.depth * dir);
          s.y(my * 16 * s.depth * dir);
        });
      },
      { passive: true }
    );
    hero.addEventListener(
      "pointerleave",
      () => {
        setPhotoX?.(0);
        setPhotoY?.(0);
        setPhotoRot?.(0);
        floatSetters.forEach((s) => {
          s.x(0);
          s.y(0);
        });
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------- process */
  const processTrack = document.querySelector(".process-track");
  if (processTrack) {
    const steps = gsap.utils.toArray(processTrack.querySelectorAll(".process-step"));
    let line = processTrack.querySelector(".process-progress");
    let fill = processTrack.querySelector(".process-progress__fill");
    if (!line) {
      line = document.createElement("div");
      line.className = "process-progress";
      line.setAttribute("aria-hidden", "true");
      fill = document.createElement("span");
      fill.className = "process-progress__fill";
      line.appendChild(fill);
      processTrack.prepend(line);
    }

    ScrollTrigger.create({
      trigger: processTrack,
      start: "top 78%",
      once: true,
      onEnter: () => {
        processTrack.classList.add("is-inview");
        gsap.fromTo(
          steps,
          { opacity: 0, y: 26, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, stagger: 0.13, duration: 0.85, ease: "back.out(1.3)" }
        );
      },
    });

    ScrollTrigger.create({
      trigger: processTrack,
      start: "top 72%",
      end: "bottom 55%",
      scrub: 0.35,
      onUpdate: (self) => {
        const p = self.progress;
        if (fill) {
          const vertical = window.matchMedia("(max-width: 1024px)").matches;
          fill.style.transform = vertical ? `scaleY(${p})` : `scaleX(${p})`;
        }
        steps.forEach((step, i) => {
          const threshold = steps.length > 1 ? i / (steps.length - 1) : 1;
          step.classList.toggle("is-active", p >= threshold - 0.08);
        });
      },
    });
  }

  /* ------------------------------------------------------ sticky benefits */
  const sticky = document.querySelector("[data-sticky-benefits]");
  if (sticky) {
    const panels = gsap.utils.toArray(sticky.querySelectorAll("[data-benefit-panel]"));
    const visual = sticky.querySelector("[data-benefit-visual]");
    if (panels.length) {
      panels.forEach((panel, i) => {
        ScrollTrigger.create({
          trigger: panel,
          start: "top center+=10%",
          end: "bottom center-=10%",
          onEnter: () => setBenefit(i),
          onEnterBack: () => setBenefit(i),
        });
      });
      function setBenefit(index) {
        panels.forEach((p, i) => p.classList.toggle("is-active", i === index));
        if (visual) visual.setAttribute("data-active", String(index));
        const active = panels[index];
        if (active) {
          gsap.fromTo(
            active,
            { opacity: 0.6, y: 14 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
          );
        }
      }
      setBenefit(0);
    }
  }

  /* ------------------------------------------------- trust strip entrance */
  const trustStrip = document.querySelector(".trust-strip");
  if (trustStrip) {
    gsap.fromTo(
      trustStrip,
      { opacity: 0, y: 26, scale: 0.93 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: "back.out(1.45)",
        scrollTrigger: { trigger: trustStrip, start: "top 92%", once: true },
      }
    );
  }

  /* ------------------------------------------------------ footer entrance */
  const footer = document.querySelector("[data-site-footer] > footer, .site-footer");
  if (footer) {
    const beats = footer.querySelectorAll("footer > *, .footer-grid > *, .footer-legal");
    const unique = Array.from(beats).filter((el, i, arr) => arr.indexOf(el) === i);
    if (unique.length) {
      gsap.fromTo(
        unique,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.09,
          ease: "power3.out",
          scrollTrigger: { trigger: footer, start: "top 88%", once: true },
        }
      );
    }
  }

  /* ---------------------------------------------------- visual soft float */
  if (heroVisual) {
    gsap.to(heroVisual, {
      y: -8,
      ease: "sine.inOut",
      duration: 6,
      repeat: -1,
      yoyo: true,
      delay: 2.1,
    });
  }

  /* Keep positions fresh after lazy images and injected sections settle. */
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener("load", refresh);
  window.setTimeout(refresh, 900);
  window.addEventListener("ui:rendered", refresh);

  /* ------------------------------- teaser: CSS ambient float handoff done */
  window.setTimeout(() => html.classList.add("motion-ready"), 1400);

  /* --------------------------------------------------- pageleave cleanup */
  window.addEventListener(
    "pagehide",
    () => {
      try {
        intro?.kill();
        ScrollTrigger.getAll().forEach((st) => st.kill());
      } catch {
        /* no-op */
      }
    },
    { once: true }
  );
}
