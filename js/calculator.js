/**
 * Loan planning calculators (indicative estimates).
 *
 * Modes: EMI, Affordability, Down-Payment, Balance Transfer.
 * EMI uses the reducing-balance formula:
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 * Results exclude processing fees, insurance and other charges. Lender
 * sanction terms prevail.
 */
import { business } from "./data.js";

const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNum = (value) => {
  const digits = String(value ?? "").replace(/[^\d.]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};

export function initCalculator() {
  const mounts = document.querySelectorAll("[data-emi-calculator]");
  if (!mounts.length) return;
  mounts.forEach((mount, i) => {
    mount.innerHTML = calculatorMarkup(i);
  });
  if (window.lucide) window.lucide.createIcons();
  document.querySelectorAll("[data-calc]").forEach(setupCalculator);
}

function uid(i) {
  return `calc${i}`;
}

function calculatorMarkup(i) {
  const id = uid(i);
  return `
    <div class="calc-shell" data-calc>
      <div class="calc-form">
        <div class="calc-form__head">
          <p class="eyebrow">Loan planning tools</p>
          <h3>Plan with four calculators</h3>
          <p>Choose a calculator to estimate EMI, affordability, down payment or balance-transfer savings.</p>
        </div>

        <div class="calc-tabs" role="tablist" aria-label="Calculator type">
          <button class="calc-tab is-active" type="button" role="tab" aria-selected="true" data-tab="emi" id="${id}-tab-emi" aria-controls="${id}-panel-emi">${icon("calculator")} EMI Calculator</button>
          <button class="calc-tab" type="button" role="tab" aria-selected="false" data-tab="afford" id="${id}-tab-afford" aria-controls="${id}-panel-afford">${icon("wallet")} Affordability</button>
          <button class="calc-tab" type="button" role="tab" aria-selected="false" data-tab="down" id="${id}-tab-down" aria-controls="${id}-panel-down">${icon("home")} Down-Payment</button>
          <button class="calc-tab" type="button" role="tab" aria-selected="false" data-tab="bt" id="${id}-tab-bt" aria-controls="${id}-panel-bt">${icon("arrow-left-right")} BT Calculator</button>
        </div>

        <!-- EMI -->
        <div class="calc-panel" data-panel="emi" id="${id}-panel-emi" role="tabpanel" aria-labelledby="${id}-tab-emi">
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-amount">Loan amount</label>
              <div class="calc-input-wrap"><span aria-hidden="true">₹</span>
                <input id="${id}-amount" data-emi-amount type="text" inputmode="numeric" value="25,00,000" autocomplete="off" aria-label="Loan amount in rupees">
              </div>
            </div>
            <input class="calc-range" data-emi-amount-range type="range" min="500000" max="20000000" step="50000" value="2500000" aria-label="Loan amount slider">
            <div class="calc-scale"><span>₹5 lakh</span><span>₹2 crore</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-rate">Annual interest rate</label>
              <div class="calc-input-wrap">
                <input id="${id}-rate" data-emi-rate type="number" min="1" max="30" step="0.05" value="8.5" aria-label="Annual interest rate percentage">
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <input class="calc-range" data-emi-rate-range type="range" min="5" max="15" step="0.05" value="8.5" aria-label="Interest rate slider">
            <div class="calc-scale"><span>5%</span><span>15%</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-tenure">Loan tenure</label>
              <div class="calc-input-wrap">
                <input id="${id}-tenure" data-emi-tenure type="number" min="1" max="30" step="1" value="20" aria-label="Loan tenure in years">
                <span aria-hidden="true">yrs</span>
              </div>
            </div>
            <input class="calc-range" data-emi-tenure-range type="range" min="1" max="30" step="1" value="20" aria-label="Loan tenure slider">
            <div class="calc-scale"><span>1 year</span><span>30 years</span></div>
          </div>
        </div>

        <!-- Affordability -->
        <div class="calc-panel" data-panel="afford" id="${id}-panel-afford" role="tabpanel" aria-labelledby="${id}-tab-afford" hidden>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-a-emi">Desired monthly EMI</label>
              <div class="calc-input-wrap"><span aria-hidden="true">₹</span>
                <input id="${id}-a-emi" data-a-emi type="text" inputmode="numeric" value="30,000" autocomplete="off" aria-label="Desired monthly EMI">
              </div>
            </div>
            <input class="calc-range" data-a-emi-range type="range" min="5000" max="300000" step="1000" value="30000" aria-label="Desired EMI slider">
            <div class="calc-scale"><span>₹5,000</span><span>₹3 lakh</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-a-rate">Annual interest rate</label>
              <div class="calc-input-wrap">
                <input id="${id}-a-rate" data-a-rate type="number" min="1" max="30" step="0.05" value="8.5" aria-label="Annual interest rate">
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <input class="calc-range" data-a-rate-range type="range" min="5" max="15" step="0.05" value="8.5" aria-label="Interest rate slider">
            <div class="calc-scale"><span>5%</span><span>15%</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-a-tenure">Loan tenure</label>
              <div class="calc-input-wrap">
                <input id="${id}-a-tenure" data-a-tenure type="number" min="1" max="30" step="1" value="20" aria-label="Loan tenure in years">
                <span aria-hidden="true">yrs</span>
              </div>
            </div>
            <input class="calc-range" data-a-tenure-range type="range" min="1" max="30" step="1" value="20" aria-label="Loan tenure slider">
            <div class="calc-scale"><span>1 year</span><span>30 years</span></div>
          </div>
        </div>

        <!-- Down-Payment -->
        <div class="calc-panel" data-panel="down" id="${id}-panel-down" role="tabpanel" aria-labelledby="${id}-tab-down" hidden>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-d-price">Property price</label>
              <div class="calc-input-wrap"><span aria-hidden="true">₹</span>
                <input id="${id}-d-price" data-d-price type="text" inputmode="numeric" value="50,00,000" autocomplete="off" aria-label="Property price">
              </div>
            </div>
            <input class="calc-range" data-d-price-range type="range" min="1000000" max="50000000" step="100000" value="5000000" aria-label="Property price slider">
            <div class="calc-scale"><span>₹10 lakh</span><span>₹5 crore</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-d-down">Down payment</label>
              <div class="calc-input-wrap">
                <input id="${id}-d-down" data-d-down type="number" min="0" max="90" step="1" value="20" aria-label="Down payment percentage">
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <input class="calc-range" data-d-down-range type="range" min="0" max="80" step="1" value="20" aria-label="Down payment slider">
            <div class="calc-scale"><span>0%</span><span>80%</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-d-rate">Annual interest rate</label>
              <div class="calc-input-wrap">
                <input id="${id}-d-rate" data-d-rate type="number" min="1" max="30" step="0.05" value="8.5" aria-label="Annual interest rate">
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <input class="calc-range" data-d-rate-range type="range" min="5" max="15" step="0.05" value="8.5" aria-label="Interest rate slider">
            <div class="calc-scale"><span>5%</span><span>15%</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-d-tenure">Loan tenure</label>
              <div class="calc-input-wrap">
                <input id="${id}-d-tenure" data-d-tenure type="number" min="1" max="30" step="1" value="20" aria-label="Loan tenure in years">
                <span aria-hidden="true">yrs</span>
              </div>
            </div>
            <input class="calc-range" data-d-tenure-range type="range" min="1" max="30" step="1" value="20" aria-label="Loan tenure slider">
            <div class="calc-scale"><span>1 year</span><span>30 years</span></div>
          </div>
        </div>

        <!-- Balance Transfer -->
        <div class="calc-panel" data-panel="bt" id="${id}-panel-bt" role="tabpanel" aria-labelledby="${id}-tab-bt" hidden>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-b-out">Outstanding principal</label>
              <div class="calc-input-wrap"><span aria-hidden="true">₹</span>
                <input id="${id}-b-out" data-b-out type="text" inputmode="numeric" value="20,00,000" autocomplete="off" aria-label="Outstanding principal">
              </div>
            </div>
            <input class="calc-range" data-b-out-range type="range" min="100000" max="20000000" step="50000" value="2000000" aria-label="Outstanding principal slider">
            <div class="calc-scale"><span>₹1 lakh</span><span>₹2 crore</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-b-cur">Current interest rate</label>
              <div class="calc-input-wrap">
                <input id="${id}-b-cur" data-b-cur type="number" min="1" max="30" step="0.05" value="9.5" aria-label="Current interest rate">
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <input class="calc-range" data-b-cur-range type="range" min="5" max="18" step="0.05" value="9.5" aria-label="Current rate slider">
            <div class="calc-scale"><span>5%</span><span>18%</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-b-rem">Remaining tenure</label>
              <div class="calc-input-wrap">
                <input id="${id}-b-rem" data-b-rem type="number" min="1" max="30" step="1" value="15" aria-label="Remaining tenure in years">
                <span aria-hidden="true">yrs</span>
              </div>
            </div>
            <input class="calc-range" data-b-rem-range type="range" min="1" max="30" step="1" value="15" aria-label="Remaining tenure slider">
            <div class="calc-scale"><span>1 year</span><span>30 years</span></div>
          </div>
          <div class="calc-field">
            <div class="calc-field__head">
              <label for="${id}-b-new">New interest rate</label>
              <div class="calc-input-wrap">
                <input id="${id}-b-new" data-b-new type="number" min="1" max="30" step="0.05" value="8.5" aria-label="New interest rate">
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <input class="calc-range" data-b-new-range type="range" min="5" max="15" step="0.05" value="8.5" aria-label="New rate slider">
            <div class="calc-scale"><span>5%</span><span>15%</span></div>
          </div>
        </div>

        <p class="calc-form__note" data-calc-note>
          Estimates use the standard reducing-balance method and exclude processing fees, insurance and other charges. The lender's sanction terms will prevail.
        </p>
      </div>

      <div class="calc-result">
        <span class="calc-result__label" data-result-label>Estimated monthly EMI</span>
        <div class="calc-result__emi" data-emi-output>₹—<small>/ month</small></div>

        <div class="calc-donut-row">
          <div class="calc-donut" data-calc-donut><span data-donut-label>Principal<br>vs interest</span></div>
          <div class="calc-legend" data-calc-legend>
            <div><i aria-hidden="true"></i> <span data-leg-a>Principal</span></div>
            <div><i aria-hidden="true"></i> <span data-leg-b>Total interest</span></div>
          </div>
        </div>

        <dl class="calc-breakdown">
          <div><dt data-k1>Principal amount</dt><dd data-calc-principal>—</dd></div>
          <div><dt data-k2>Total interest</dt><dd data-calc-interest>—</dd></div>
          <div><dt data-k3>Total repayment</dt><dd data-calc-total>—</dd></div>
        </dl>

        <a class="btn btn--light" href="contact.html?service=Home+Loan">
          Talk to a Loan Expert ${icon("arrow-up-right")}
        </a>
      </div>
    </div>
  `;
}

function setProgress(value, range) {
  if (!range) return;
  const progress = ((value - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
  range.style.setProperty("--range-progress", `${clamp(progress, 0, 100)}%`);
}

function bindMoney(textEl, rangeEl, min, max, onChange) {
  if (!textEl || !rangeEl) return;
  const sync = (source) => {
    if (source === "range") {
      textEl.value = formatNumber(rangeEl.value);
    } else {
      const raw = toNum(textEl.value);
      const bounded = clamp(raw || 0, 0, max);
      rangeEl.value = String(clamp(bounded, min, max));
      if (textEl.value.trim()) textEl.value = formatNumber(bounded);
    }
    setProgress(Number(rangeEl.value), rangeEl);
    onChange();
  };
  textEl.addEventListener("input", () => sync("input"));
  textEl.addEventListener("blur", () => {
    if (!textEl.value.trim()) {
      textEl.value = formatNumber(Number(rangeEl.min));
      rangeEl.value = rangeEl.min;
    }
    sync("input");
  });
  rangeEl.addEventListener("input", () => sync("range"));
  setProgress(Number(rangeEl.value), rangeEl);
}

function bindNumber(numEl, rangeEl, min, max, onChange) {
  if (!numEl || !rangeEl) return;
  rangeEl.addEventListener("input", () => {
    numEl.value = rangeEl.value;
    setProgress(Number(rangeEl.value), rangeEl);
    onChange();
  });
  numEl.addEventListener("input", () => {
    const v = Number(numEl.value);
    if (Number.isFinite(v) && v >= Number(rangeEl.min) && v <= Number(rangeEl.max)) rangeEl.value = String(v);
    setProgress(Number(rangeEl.value), rangeEl);
    onChange();
  });
  numEl.addEventListener("blur", () => {
    const v = clamp(Number(numEl.value) || Number(rangeEl.value), min, max);
    numEl.value = String(v);
    rangeEl.value = String(clamp(v, Number(rangeEl.min), Number(rangeEl.max)));
    setProgress(Number(rangeEl.value), rangeEl);
    onChange();
  });
  setProgress(Number(rangeEl.value), rangeEl);
}

function calcEmi(principal, annualRate, years) {
  if (!principal || !annualRate || !years) return null;
  const monthlyRate = annualRate / 12 / 100;
  const months = Math.round(years * 12);
  if (!monthlyRate) {
    const emi = principal / months;
    return { emi, total: principal, interest: 0, months };
  }
  const factor = Math.pow(1 + monthlyRate, months);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  const total = emi * months;
  return { emi, total, interest: total - principal, months };
}

function setupCalculator(root) {
  const tabs = Array.from(root.querySelectorAll("[data-tab]"));
  const panels = Array.from(root.querySelectorAll("[data-panel]"));
  const note = root.querySelector("[data-calc-note]");
  const out = {
    label: root.querySelector("[data-result-label]"),
    emi: root.querySelector("[data-emi-output]"),
    donut: root.querySelector("[data-calc-donut]"),
    donutLabel: root.querySelector("[data-donut-label]"),
    legA: root.querySelector("[data-leg-a]"),
    legB: root.querySelector("[data-leg-b]"),
    k1: root.querySelector("[data-k1]"),
    k2: root.querySelector("[data-k2]"),
    k3: root.querySelector("[data-k3]"),
    v1: root.querySelector("[data-calc-principal]"),
    v2: root.querySelector("[data-calc-interest]"),
    v3: root.querySelector("[data-calc-total]"),
  };

  let active = "emi";

  const setResult = ({ label, main, mainSmall = "/ month", share, shareLabel, legA, legB, k1, v1, k2, v2, k3, v3, noteText }) => {
    if (out.label) out.label.textContent = label;
    if (out.emi) out.emi.innerHTML = `${main}<small>${mainSmall}</small>`;
    if (out.donut) out.donut.style.setProperty("--principal-share", `${clamp(share ?? 0, 0, 100)}%`);
    if (out.donutLabel) out.donutLabel.innerHTML = shareLabel || "Principal<br>vs interest";
    if (out.legA) out.legA.textContent = legA || "Principal";
    if (out.legB) out.legB.textContent = legB || "Total interest";
    if (out.k1) out.k1.textContent = k1;
    if (out.k2) out.k2.textContent = k2;
    if (out.k3) out.k3.textContent = k3;
    if (out.v1) out.v1.textContent = v1;
    if (out.v2) out.v2.textContent = v2;
    if (out.v3) out.v3.textContent = v3;
    if (note && noteText) note.textContent = noteText;
  };

  const render = () => {
    if (active === "emi") {
      const p = toNum(root.querySelector("[data-emi-amount]")?.value);
      const r = Number(root.querySelector("[data-emi-rate]")?.value);
      const y = Number(root.querySelector("[data-emi-tenure]")?.value);
      const res = calcEmi(p, r, y);
      if (!res) return setResult({ label: "Estimated monthly EMI", main: "₹—", share: 0, k1: "Principal amount", v1: "—", k2: "Total interest", v2: "—", k3: "Total repayment", v3: "—", noteText: "Estimates use the standard reducing-balance method and exclude processing fees, insurance and other charges. The lender's sanction terms will prevail." });
      setResult({
        label: "Estimated monthly EMI",
        main: inr.format(Math.round(res.emi)),
        share: (p / res.total) * 100,
        shareLabel: "Principal<br>vs interest",
        legA: "Principal", legB: "Total interest",
        k1: "Principal amount", v1: inr.format(Math.round(p)),
        k2: "Total interest", v2: inr.format(Math.round(res.interest)),
        k3: "Total repayment", v3: inr.format(Math.round(res.total)),
        noteText: "Estimates use the standard reducing-balance method and exclude processing fees, insurance and other charges. The lender's sanction terms will prevail.",
      });
    } else if (active === "afford") {
      const emi = toNum(root.querySelector("[data-a-emi]")?.value);
      const r = Number(root.querySelector("[data-a-rate]")?.value);
      const y = Number(root.querySelector("[data-a-tenure]")?.value);
      const mr = r / 12 / 100;
      const n = Math.round(y * 12);
      if (!emi || !mr || !n) return;
      const factor = Math.pow(1 + mr, n);
      const principal = emi * (factor - 1) / (mr * factor);
      const total = emi * n;
      const interest = total - principal;
      setResult({
        label: "Estimated loan eligibility",
        main: inr.format(Math.round(principal)),
        mainSmall: "indicative",
        share: (principal / total) * 100,
        shareLabel: "Loan<br>vs interest",
        legA: "Eligible loan", legB: "Total interest",
        k1: "Monthly EMI", v1: inr.format(Math.round(emi)),
        k2: "Total interest", v2: inr.format(Math.round(interest)),
        k3: "Total repayment", v3: inr.format(Math.round(total)),
        noteText: "Affordability is an indicative estimate from your desired EMI, rate and tenure. Actual eligibility depends on income, obligations, credit profile and lender policy.",
      });
    } else if (active === "down") {
      const price = toNum(root.querySelector("[data-d-price]")?.value);
      const downPct = Number(root.querySelector("[data-d-down]")?.value);
      const r = Number(root.querySelector("[data-d-rate]")?.value);
      const y = Number(root.querySelector("[data-d-tenure]")?.value);
      const downAmt = price * clamp(downPct, 0, 100) / 100;
      const loan = Math.max(0, price - downAmt);
      const res = calcEmi(loan, r, y);
      if (!res) return;
      setResult({
        label: "Estimated EMI on financed amount",
        main: inr.format(Math.round(res.emi)),
        share: (loan / (res.total || 1)) * 100,
        shareLabel: "Loan<br>vs interest",
        legA: "Loan amount", legB: "Total interest",
        k1: "Down payment", v1: `${inr.format(Math.round(downAmt))} (${downPct}%)`,
        k2: "Loan amount", v2: inr.format(Math.round(loan)),
        k3: "Total repayment", v3: inr.format(Math.round(res.total)),
        noteText: "Down-payment and EMI figures are indicative. Actual loan-to-value, margin money and terms depend on the property and lender policy.",
      });
    } else if (active === "bt") {
      const outP = toNum(root.querySelector("[data-b-out]")?.value);
      const curR = Number(root.querySelector("[data-b-cur]")?.value);
      const remY = Number(root.querySelector("[data-b-rem]")?.value);
      const newR = Number(root.querySelector("[data-b-new]")?.value);
      const cur = calcEmi(outP, curR, remY);
      const neu = calcEmi(outP, newR, remY);
      if (!cur || !neu) return;
      const saving = Math.max(0, cur.total - neu.total);
      const share = neu.total ? (neu.emi * neu.months - (neu.interest)) / neu.total * 100 : 0;
      setResult({
        label: "Indicative monthly saving",
        main: inr.format(Math.round(Math.max(0, cur.emi - neu.emi))),
        share: clamp((outP / (neu.total || 1)) * 100, 0, 100),
        shareLabel: "Current<br>vs new",
        legA: "Current EMI", legB: "New EMI",
        k1: "Current EMI", v1: inr.format(Math.round(cur.emi)),
        k2: "New EMI", v2: inr.format(Math.round(neu.emi)),
        k3: "Interest saved*", v3: inr.format(Math.round(saving)),
        noteText: "Balance-transfer saving is indicative over the remaining tenure shown and excludes transfer/processing charges, foreclosure conditions and other costs. *Approximate, subject to lender terms.",
      });
    }
  };

  const activate = (tab) => {
    active = tab;
    tabs.forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    panels.forEach((p) => {
      p.hidden = p.dataset.panel !== tab;
    });
    render();
  };

  tabs.forEach((btn) => btn.addEventListener("click", () => activate(btn.dataset.tab)));

  // EMI bindings
  bindMoney(root.querySelector("[data-emi-amount]"), root.querySelector("[data-emi-amount-range]"), 500000, 20000000, render);
  bindNumber(root.querySelector("[data-emi-rate]"), root.querySelector("[data-emi-rate-range]"), 1, 30, render);
  bindNumber(root.querySelector("[data-emi-tenure]"), root.querySelector("[data-emi-tenure-range]"), 1, 30, render);
  // Afford
  bindMoney(root.querySelector("[data-a-emi]"), root.querySelector("[data-a-emi-range]"), 5000, 300000, render);
  bindNumber(root.querySelector("[data-a-rate]"), root.querySelector("[data-a-rate-range]"), 1, 30, render);
  bindNumber(root.querySelector("[data-a-tenure]"), root.querySelector("[data-a-tenure-range]"), 1, 30, render);
  // Down
  bindMoney(root.querySelector("[data-d-price]"), root.querySelector("[data-d-price-range]"), 1000000, 50000000, render);
  bindNumber(root.querySelector("[data-d-down]"), root.querySelector("[data-d-down-range]"), 0, 90, render);
  bindNumber(root.querySelector("[data-d-rate]"), root.querySelector("[data-d-rate-range]"), 1, 30, render);
  bindNumber(root.querySelector("[data-d-tenure]"), root.querySelector("[data-d-tenure-range]"), 1, 30, render);
  // BT
  bindMoney(root.querySelector("[data-b-out]"), root.querySelector("[data-b-out-range]"), 100000, 20000000, render);
  bindNumber(root.querySelector("[data-b-cur]"), root.querySelector("[data-b-cur-range]"), 1, 30, render);
  bindNumber(root.querySelector("[data-b-rem]"), root.querySelector("[data-b-rem-range]"), 1, 30, render);
  bindNumber(root.querySelector("[data-b-new]"), root.querySelector("[data-b-new-range]"), 1, 30, render);

  render();

  root.addEventListener("input", () => {
    try { import("./backend.js").then((m) => m.trackEvent("calculator_interaction", { page: location.pathname })); } catch {}
  }, { once: true, passive: true });

  root.querySelector('a[href^="contact.html"]')?.setAttribute("title", `Talk to ${business.name}`);
}
