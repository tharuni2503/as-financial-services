/**
 * Enquiry form: accessible validation + Supabase submission (when configured).
 * Success is shown ONLY after successful storage. If unavailable/not configured,
 * a clear error is shown (no false success).
 */
import { business } from "./data.js";
import { showToast } from "./render.js";
import { submitEnquiry, isBackendConfigured, trackEvent, getConfig } from "./backend.js";

/**
 * Optional Cloudflare Turnstile. It only activates when a public site key is
 * configured; the secret is verified server-side by the Edge Function.
 */
async function setupCaptcha(form) {
  const cfg = await getConfig();
  if (!cfg || !cfg.turnstileSiteKey) return async () => "";

  let container = form.querySelector("[data-turnstile]");
  if (!container) {
    container = document.createElement("div");
    container.setAttribute("data-turnstile", "");
    container.className = "field field--full";
    const anchor = form.querySelector(".form-actions")?.closest(".field");
    if (anchor) anchor.parentNode.insertBefore(container, anchor);
    else form.appendChild(container);
  }

  await new Promise((resolve) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector("script[data-turnstile-script]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.setAttribute("data-turnstile-script", "");
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", resolve, { once: true });
    document.head.appendChild(script);
  }).catch(() => {});

  if (!window.turnstile) return async () => "";
  let widgetId = null;
  try {
    widgetId = window.turnstile.render(container, {
      sitekey: cfg.turnstileSiteKey,
      theme: "light",
    });
  } catch {
    return async () => "";
  }
  return () => {
    try {
      return window.turnstile.getResponse(widgetId) || "";
    } catch {
      return "";
    }
  };
}

const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

const normalisePhone = (value) => {
  let digits = String(value).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
};

export function initContactForm() {
  const form = document.querySelector("[data-enquiry-form]");
  if (!form) return;

  const status = document.querySelector("[data-form-status]");
  const submitButton = form.querySelector('[type="submit"]');
  const captchaReady = setupCaptcha(form);

  /* Prefill from query string (service cards, bank offers, "Apply Now"). */
  const params = new URLSearchParams(window.location.search);
  const requestedService = params.get("service");
  const requestedBank = params.get("bank");
  const intent = params.get("intent");

  if (requestedService) {
    const select = form.querySelector('[name="loanType"]');
    if (select) {
      const option = Array.from(select.options).find(
        (item) => item.value.toLowerCase() === requestedService.toLowerCase()
      );
      select.value = option ? option.value : "Other";
    }
  }

  if (requestedBank) {
    const message = form.querySelector('[name="message"]');
    if (message && !message.value) {
      message.value = `I would like to explore a home loan offer from ${requestedBank}.`;
    }
  }

  if (intent === "apply" || requestedBank) {
    window.setTimeout(() => {
      const name = form.querySelector('[name="fullName"]');
      if (name) name.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 450);
  }

  const fields = {
    fullName: {
      input: form.querySelector('[name="fullName"]'),
      validate: (value) =>
        value.trim().length >= 2 ? "" : "Please enter your full name (at least 2 characters).",
    },
    mobile: {
      input: form.querySelector('[name="mobile"]'),
      validate: (value) => {
        const digits = normalisePhone(value);
        if (!digits) return "Please enter your mobile number.";
        if (!/^[6-9]\d{9}$/.test(digits)) {
          return "Enter a valid 10-digit Indian mobile number.";
        }
        return "";
      },
    },
    email: {
      input: form.querySelector('[name="email"]'),
      validate: (value) => {
        if (!value.trim()) return "Please enter your email address.";
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
          ? ""
          : "Enter a valid email address.";
      },
    },
    loanType: {
      input: form.querySelector('[name="loanType"]'),
      validate: (value) => (value ? "" : "Please select a loan type."),
    },
    loanAmount: {
      input: form.querySelector('[name="loanAmount"]'),
      validate: (value) => {
        if (!value.trim()) return "";
        const amount = Number(String(value).replace(/\D/g, ""));
        if (!amount || amount < 100000) return "Enter an amount of at least ₹1,00,000, or leave blank.";
        if (amount > 100000000) return "Please enter an amount below ₹10 crore.";
        return "";
      },
    },
    message: {
      input: form.querySelector('[name="message"]'),
      validate: (value) =>
        value.length <= 900 ? "" : "Please keep your message under 900 characters.",
    },
    consent: {
      input: form.querySelector('[name="consent"]'),
      validate: (_, input) =>
        input.checked ? "" : "Please confirm that you agree to be contacted.",
    },
  };

  const setError = (input, message) => {
    const field = input.closest(".field") || input.closest(".consent");
    if (!field) return;
    field.classList.toggle("has-error", Boolean(message));
    let error = field.querySelector(".field-error");
    if (!message) {
      if (error) error.remove();
      input.setAttribute("aria-invalid", "false");
      input.removeAttribute("aria-describedby");
      return;
    }
    if (!error) {
      error = document.createElement("p");
      error.className = "field-error";
      field.appendChild(error);
    }
    error.textContent = message;
    error.setAttribute("role", "alert");
    input.setAttribute("aria-invalid", "true");
    const errorId = `error-${input.name}`;
    error.id = errorId;
    input.setAttribute("aria-describedby", errorId);
  };

  Object.values(fields).forEach(({ input }) => {
    if (!input) return;
    const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, () => {
      if (input.closest(".field")?.classList.contains("has-error")) {
        setError(input, "");
      }
    });
  });

  const validateAll = () => {
    let firstInvalid = null;
    let valid = true;

    Object.values(fields).forEach(({ input, validate }) => {
      if (!input) return;
      const message = validate(input.value, input);
      setError(input, message);
      if (message) {
        valid = false;
        if (!firstInvalid) firstInvalid = input;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: false });
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!validateAll()) {
      if (status) {
        status.hidden = false;
        status.classList.add("is-error");
        status.innerHTML = `
          <div class="form-status__head">
            <span class="form-status__icon">${icon("alert-circle")}</span>
            <h3>Please review the highlighted fields</h3>
          </div>
          <p>We could not validate your enquiry yet. Check the messages next to each field and try again.</p>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    if (submitButton) {
      submitButton.setAttribute("aria-busy", "true");
      submitButton.disabled = true;
    }

    (async () => {
      const configured = await isBackendConfigured();
      if (!configured) {
        if (submitButton) { submitButton.removeAttribute("aria-busy"); submitButton.disabled = false; }
        if (status) {
          status.hidden = false;
          status.classList.add("is-error");
          status.innerHTML = `
            <div class="form-status__head"><span class="form-status__icon">${icon("alert-circle")}</span><h3>Enquiry not sent (backend not configured)</h3></div>
            <p>Your details were validated, but this site is not connected to the enquiry database yet. No data was stored or delivered. Please configure Supabase (<code>js/supabase-config.js</code>) or contact us directly.</p>
            <div class="form-status__actions">
              <a class="btn btn--primary btn--sm" href="tel:${business.phone.tel}">Call ${business.phone.display} ${icon("phone")}</a>
              <a class="btn btn--ghost btn--sm" href="https://wa.me/${business.whatsapp.number}" target="_blank" rel="noopener noreferrer">WhatsApp ${icon("message-circle")}</a>
            </div>`;
          if (window.lucide) window.lucide.createIcons();
          status.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        showToast("Enquiry not sent: database not configured. No data was stored.", "error");
        return;
      }

      const data = new FormData(form);
      const payload = {
        customer_name: String(data.get("fullName") || "").trim(),
        phone: normalisePhone(String(data.get("mobile") || "")),
        email: String(data.get("email") || "").trim(),
        loan_category: String(data.get("loanType") || "").trim(),
        requested_amount: String(data.get("loanAmount") || "").replace(/\D/g, "") ? Number(String(data.get("loanAmount") || "").replace(/\D/g, "")) : null,
        employment_type: String(data.get("employmentType") || "").trim() || null,
        city_location: String(data.get("cityLocation") || "").trim() || null,
        message: String(data.get("message") || "").trim() || null,
        source_page: location.pathname + location.search,
        status: "New"
      };
      const captchaToken = await captchaReady;
      const result = await submitEnquiry(payload, captchaToken);
      if (submitButton) { submitButton.removeAttribute("aria-busy"); submitButton.disabled = false; }

      if (!result.ok) {
        if (status) {
          status.hidden = false;
          status.classList.add("is-error");
          status.innerHTML = `
            <div class="form-status__head"><span class="form-status__icon">${icon("alert-circle")}</span><h3>Enquiry could not be sent</h3></div>
            <p>We could not save your enquiry right now. No data was confirmed as stored. Please try again, or contact us directly by phone, WhatsApp, or email.</p>
            <div class="form-status__actions">
              <a class="btn btn--primary btn--sm" href="tel:${business.phone.tel}">Call ${business.phone.display} ${icon("phone")}</a>
              <a class="btn btn--ghost btn--sm" href="https://wa.me/${business.whatsapp.number}" target="_blank" rel="noopener noreferrer">WhatsApp ${icon("message-circle")}</a>
            </div>`;
          if (window.lucide) window.lucide.createIcons();
          status.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        showToast("Enquiry not sent. Please try again or contact us directly.", "error");
        return;
      }

      trackEvent('enquiry_submit', { loan_category: payload.loan_category, source_page: payload.source_page });
      form.reset();
      if (status) {
        status.hidden = false;
        status.classList.remove("is-error");
        status.innerHTML = `
          <div class="form-status__head"><span class="form-status__icon">${icon("check")}</span><h3>Enquiry submitted successfully</h3></div>
          <p>Thank you. Your enquiry has been saved securely. Our team will review it and contact you using the details you provided.</p>`;
        if (window.lucide) window.lucide.createIcons();
        status.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showToast("Enquiry submitted successfully.");
    })();
  });
}
