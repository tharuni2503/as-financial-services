/**
 * AS Financial Services — admin dashboard.
 *
 * Uses only the Supabase anon key + the authenticated admin session. Every
 * database/storage operation is additionally constrained by RLS and storage
 * policies. Customer data is never rendered on public pages.
 */
import { requireAdminSession, getConfig } from '../backend.js';
import { services as staticServices } from '../data.js';

/* ------------------------------------------------------------------ setup */

const STATUSES = ['New', 'Contacted', 'Interested', 'Documents Pending', 'Under Review', 'Approved', 'Rejected', 'Closed'];
const OPEN_STATUSES = ['New', 'Contacted', 'Interested', 'Documents Pending', 'Under Review'];
const LOAN_TYPES = [
  'Personal Loan', 'Home Loan', 'Business Loan', 'Education Loan',
  'Mortgage Loan / Loan Against Property', 'Private Funds', 'Project Funding',
  'Insurance', 'Instant Loan', 'Open Plot Purchase', 'New Car Loan',
  'Used Car Loan', 'Doctors Loan', 'Other'
];
const PAGE_SIZE = 15;
const CMS_CACHE_KEY = 'as_cms_cache_v1';
const LOGO_BUCKET = 'bank-logos';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const root = document.getElementById('viewRoot');
const titleEl = document.getElementById('viewTitle');
const adminMeta = document.getElementById('adminMeta');
const toastRoot = document.getElementById('toastRoot');
const modalRoot = document.getElementById('modalRoot');
const shell = document.getElementById('adminShell');

let ctx = null;
let adminCache = null;
let categoryCache = null;
let analyticsCache = { key: '', rows: [], summary: null };

const state = {
  enquiries: {
    page: 1, size: PAGE_SIZE, sort: 'submitted_at', asc: false,
    search: '', status: '', loan: '', from: '', to: '',
    duplicatesOnly: false, rows: [], count: 0, dupMap: new Map()
  },
  applications: {
    page: 1, size: PAGE_SIZE, sort: 'application_date', asc: false,
    search: '', status: '', loan: '', from: '', to: '', rows: [], count: 0
  },
  analytics: { preset: '30', from: '', to: '', rows: [], summary: null }
};

/* ---------------------------------------------------------------- helpers */

const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};
const fmtMoney = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return esc(value);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const fmtNumber = (value) => Number(value || 0).toLocaleString('en-IN');
const slugify = (value = '') =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'lender';

const statusClass = (status = '') => `badge badge--${slugify(status) || 'default'}`;
const statusBadge = (status) => `<span class="${statusClass(status)}">${esc(status || '—')}</span>`;

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>`;
  toastRoot.appendChild(el);
  window.setTimeout(() => {
    el.classList.add('is-leaving');
    window.setTimeout(() => el.remove(), 300);
  }, 4200);
}

function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.textContent = label || 'Working…';
  } else {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

function skeleton(cards = 4, rows = 5) {
  return `
    <div class="cards">${Array.from({ length: cards }).map(() => '<div class="card skeleton-card"><span class="sk sk--sm"></span><span class="sk sk--lg"></span></div>').join('')}</div>
    <div class="panel"><div class="sk sk--title"></div>${Array.from({ length: rows }).map(() => '<div class="sk sk--row"></div>').join('')}</div>`;
}

function emptyState(title, text, action = '') {
  return `<div class="empty"><div class="empty__icon">◇</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

function errorPanel(error, context = '') {
  const message = error?.message || error?.error_description || String(error || 'Unknown error');
  return `<div class="panel panel--error">
    <h3>Could not load this section</h3>
    <p>${esc(context)}</p>
    <p class="mono">${esc(message)}</p>
    <p class="muted">Check that both SQL migrations have been applied, the admin profile is active, and RLS/storage policies are configured.</p>
  </div>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openModal({ title, subtitle = '', body, wide = false, onMount }) {
  let closeFn = () => {};
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `
    <div class="modal${wide ? ' modal--wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal__head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <button class="modal__close" type="button" aria-label="Close dialog" data-modal-close>×</button>
      </header>
      <div class="modal__body">${body}</div>
    </div>`;
  modalRoot.appendChild(overlay);
  document.body.classList.add('modal-open');

  const onKey = (event) => {
    if (event.key === 'Escape') closeFn();
  };
  closeFn = () => {
    overlay.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
  };
  overlay.querySelector('[data-modal-close]').addEventListener('click', closeFn);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeFn();
  });
  document.addEventListener('keydown', onKey);
  if (onMount) onMount(overlay.querySelector('.modal'), closeFn);
  return { overlay, close: closeFn };
}

function confirmDialog({ title = 'Confirm action', message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      body: `
        <p class="confirm-text">${esc(message)}</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--gold'}" type="button" data-confirm>${esc(confirmLabel)}</button>
        </div>`,
      onMount: (modal) => {
        modal.querySelector('[data-cancel]').onclick = () => { close(); resolve(false); };
        modal.querySelector('[data-confirm]').onclick = () => { close(); resolve(true); };
      }
    });
  });
}

async function logAction(action, entity_type, entity_id, details = {}) {
  try {
    await ctx.client.from('admin_activity_logs').insert({
      admin_id: ctx.profile.id,
      action,
      entity_type,
      entity_id: entity_id || null,
      details
    });
  } catch {
    /* logging must never block the action */
  }
}

async function countRows(table, apply = (q) => q) {
  try {
    let query = ctx.client.from(table).select('*', { count: 'exact', head: true });
    query = apply(query);
    const { count, error } = await query;
    if (error) return { count: 0, error };
    return { count: count || 0, error: null };
  } catch (error) {
    return { count: 0, error };
  }
}

async function getAdmins() {
  if (adminCache) return adminCache;
  const { data, error } = await ctx.client
    .from('admin_profiles')
    .select('id,full_name,email,role,is_active')
    .order('full_name', { ascending: true });
  if (error) throw error;
  adminCache = data || [];
  return adminCache;
}

async function getCategories() {
  if (categoryCache) return categoryCache;
  const { data, error } = await ctx.client.from('customer_enquiries').select('loan_category').limit(3000);
  if (error) throw error;
  const set = new Set(LOAN_TYPES);
  (data || []).forEach((row) => { if (row.loan_category) set.add(row.loan_category); });
  categoryCache = [...set].sort();
  return categoryCache;
}

function options(values, selected = '') {
  return values.map((value) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('');
}

function statusOptions(selected = '', includeAll = true) {
  return `${includeAll ? '<option value="">All statuses</option>' : ''}${options(STATUSES, selected)}`;
}

/* --------------------------------------------------------------- boot/nav */

async function boot() {
  ctx = await requireAdminSession('./login.html');
  if (!ctx) return;

  const name = ctx.profile.full_name || ctx.profile.email || 'Administrator';
  adminMeta.textContent = `${name} · ${ctx.profile.role || 'admin'} · signed in`;
  const nameEl = document.querySelector('[data-admin-name]');
  const roleEl = document.querySelector('[data-admin-role]');
  const initialEl = document.querySelector('[data-admin-initial]');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = ctx.profile.role || 'admin';
  if (initialEl) initialEl.textContent = String(name).trim().charAt(0).toUpperCase() || 'A';

  bindNav();
  bindSidebar();
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Sign out',
      message: 'Sign out of the admin console on this device?',
      confirmLabel: 'Sign out'
    });
    if (!ok) return;
    await ctx.client.auth.signOut();
    location.href = './login.html';
  });

  await render('overview');
  refreshNavCounts();
}

function bindNav() {
  document.querySelectorAll('#nav [data-view]').forEach((button) => {
    button.addEventListener('click', () => render(button.dataset.view));
  });
}

function bindSidebar() {
  const toggle = document.querySelector('[data-sidebar-toggle]');
  const close = document.querySelector('[data-sidebar-close]');
  const closeSidebar = () => shell.classList.remove('is-open');
  toggle?.addEventListener('click', () => shell.classList.toggle('is-open'));
  close?.addEventListener('click', closeSidebar);
  window.addEventListener('hashchange', closeSidebar);
}

const VIEW_TITLES = {
  overview: 'Overview',
  followups: 'Follow-ups',
  enquiries: 'Customers / Enquiries',
  applications: 'Loan Applications',
  categories: 'Loan Categories',
  banks: 'Bank Management',
  rates: 'Interest Rates',
  analytics: 'Website Analytics',
  content: 'Website Content',
  export: 'Export Reports',
  logs: 'Activity Logs',
  settings: 'Settings'
};

async function render(view) {
  if (!ctx) return;
  const safeView = VIEW_TITLES[view] ? view : 'overview';
  titleEl.textContent = VIEW_TITLES[safeView];
  document.querySelectorAll('#nav [data-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === safeView);
  });
  shell.classList.remove('is-open');
  root.innerHTML = skeleton();
  try {
    if (safeView === 'overview') return await overviewView();
    if (safeView === 'followups') return await followupsView();
    if (safeView === 'enquiries') return await enquiriesView();
    if (safeView === 'applications') return await applicationsView();
    if (safeView === 'categories') return await categoriesView();
    if (safeView === 'banks') return await banksView();
    if (safeView === 'rates') return await ratesView();
    if (safeView === 'analytics') return await analyticsView();
    if (safeView === 'content') return await contentView();
    if (safeView === 'export') return await exportView();
    if (safeView === 'logs') return await logsView();
    if (safeView === 'settings') return await settingsView();
  } catch (error) {
    root.innerHTML = errorPanel(error, 'The dashboard request failed.');
  }
}

async function refreshNavCounts() {
  const today = todayISO();
  const overdue = await countRows('customer_enquiries', (q) =>
    q.lt('follow_up_date', today).in('status', OPEN_STATUSES)
  );
  const target = document.querySelector('[data-nav-count="followups"]');
  if (target) {
    target.textContent = overdue.count ? String(overdue.count) : '';
    target.classList.toggle('is-hot', overdue.count > 0);
  }
}

/* --------------------------------------------------------------- overview */

async function overviewView() {
  const today = todayISO();
  const [total, fresh, contacted, apps, views, uniques, overdue, upcoming] = await Promise.all([
    countRows('customer_enquiries'),
    countRows('customer_enquiries', (q) => q.eq('status', 'New')),
    countRows('customer_enquiries', (q) => q.eq('status', 'Contacted')),
    countRows('loan_applications'),
    countRows('website_analytics', (q) => q.eq('event_type', 'page_view')),
    countRows('website_analytics', (q) => q.eq('event_type', 'unique_visit')),
    countRows('customer_enquiries', (q) => q.lt('follow_up_date', today).in('status', OPEN_STATUSES)),
    countRows('customer_enquiries', (q) => q.gte('follow_up_date', today).in('status', OPEN_STATUSES))
  ]);

  const [categoryRes, recentRes, appRes, analyticsRes] = await Promise.all([
    ctx.client.from('customer_enquiries').select('loan_category').limit(2000),
    ctx.client.from('customer_enquiries').select('*').order('submitted_at', { ascending: false }).limit(6),
    ctx.client.from('loan_applications').select('*').order('application_date', { ascending: false }).limit(5),
    ctx.client.from('website_analytics').select('event_type,event_date')
      .gte('event_date', addDays(today, -13)).limit(8000)
  ]);

  const freq = {};
  (categoryRes.data || []).forEach((row) => {
    if (row.loan_category) freq[row.loan_category] = (freq[row.loan_category] || 0) + 1;
  });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

  const daily = {};
  for (let i = 13; i >= 0; i -= 1) daily[addDays(today, -i)] = { pv: 0, uv: 0 };
  (analyticsRes.data || []).forEach((row) => {
    if (!daily[row.event_date]) daily[row.event_date] = { pv: 0, uv: 0 };
    if (row.event_type === 'page_view') daily[row.event_date].pv += 1;
    if (row.event_type === 'unique_visit') daily[row.event_date].uv += 1;
  });
  const series = Object.entries(daily).map(([date, value]) => ({ label: date.slice(5), value: value.pv }));

  const missing = [total, fresh, contacted, apps, views, uniques, overdue, upcoming].find((r) => r.error);
  const warning = missing
    ? `<div class="panel panel--warn"><strong>Some tables could not be read.</strong> Apply both migrations and confirm your admin profile is active. ${esc(missing.error?.message || '')}</div>`
    : '';

  root.innerHTML = `
    ${warning}
    <div class="cards cards--overview">
      <button class="card card--stat" data-goto="analytics"><span class="muted">Page views</span><strong>${fmtNumber(views.count)}</strong><small>Recorded first-party events</small></button>
      <button class="card card--stat" data-goto="analytics"><span class="muted">Unique visitors</span><strong>${fmtNumber(uniques.count)}</strong><small>Approximate (client key)</small></button>
      <button class="card card--stat" data-goto="enquiries"><span class="muted">Total enquiries</span><strong>${fmtNumber(total.count)}</strong><small>All time</small></button>
      <button class="card card--stat" data-goto="enquiries"><span class="muted">New enquiries</span><strong>${fmtNumber(fresh.count)}</strong><small>Awaiting first contact</small></button>
      <button class="card card--stat" data-goto="enquiries"><span class="muted">Contacted</span><strong>${fmtNumber(contacted.count)}</strong><small>Status = Contacted</small></button>
      <button class="card card--stat" data-goto="followups"><span class="muted">Overdue follow-ups</span><strong class="${overdue.count ? 'is-danger' : ''}">${fmtNumber(overdue.count)}</strong><small>${fmtNumber(upcoming.count)} upcoming</small></button>
      <button class="card card--stat" data-goto="applications"><span class="muted">Loan applications</span><strong>${fmtNumber(apps.count)}</strong><small>Separate from enquiries</small></button>
      <div class="card card--stat card--static"><span class="muted">Most requested</span><strong class="stat-text">${esc(top?.[0] || '—')}</strong><small>${top ? `${fmtNumber(top[1])} enquiries` : 'No enquiries yet'}</small></div>
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel__head"><div><h2>Page views · last 14 days</h2><p>Real recorded events only.</p></div><button class="btn btn--ghost btn--sm" data-goto="analytics">Open analytics</button></div>
        ${series.some((p) => p.value) ? lineChart(series) : emptyState('No analytics yet', 'Page views will appear here after the public site records events.')}
      </section>
      <section class="panel">
        <div class="panel__head"><div><h2>Quick actions</h2><p>Everything is admin-only and logged.</p></div></div>
        <div class="quick-actions">
          <button class="btn btn--gold" data-action="new-application">New loan application</button>
          <button class="btn btn--ghost" data-goto="followups">Review follow-ups</button>
          <button class="btn btn--ghost" data-goto="enquiries">Open customer CRM</button>
          <button class="btn btn--ghost" data-goto="export">Download reports</button>
        </div>
        <div class="mini-list">
          <h3>Recent enquiries</h3>
          ${(recentRes.data || []).length
            ? (recentRes.data || []).map((row) => `<button class="mini-row" data-open-enquiry="${esc(row.id)}"><span><strong>${esc(row.customer_name)}</strong><small>${esc(row.loan_category)} · ${fmtDate(row.submitted_at)}</small></span>${statusBadge(row.status)}</button>`).join('')
            : '<p class="muted">No enquiries recorded yet.</p>'}
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel__head"><div><h2>Recent loan applications</h2><p>Enquiries are never auto-approved or auto-converted.</p></div><button class="btn btn--ghost btn--sm" data-goto="applications">View all</button></div>
      ${(appRes.data || []).length
        ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Reference</th><th>Customer</th><th>Loan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${(appRes.data || []).map((row) => `<tr><td class="mono">${esc(row.application_ref || row.id.slice(0, 8))}</td><td>${esc(row.customer_name)}</td><td>${esc(row.loan_category)}</td><td>${fmtMoney(row.requested_amount)}</td><td>${statusBadge(row.status)}</td><td>${fmtDate(row.application_date)}</td></tr>`).join('')}</tbody></table></div>`
        : emptyState('No applications yet', 'Create an application from an enquiry when the customer is ready to proceed.')}
    </section>`;

  root.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', () => render(button.dataset.goto));
  });
  root.querySelectorAll('[data-open-enquiry]').forEach((button) => {
    button.addEventListener('click', () => openEnquiry(button.dataset.openEnquiry));
  });
  root.querySelector('[data-action="new-application"]')?.addEventListener('click', () => applicationForm({}));
}

/* -------------------------------------------------------------- follow-ups */

async function followupsView() {
  const [enqRes, appRes] = await Promise.all([
    ctx.client.from('customer_enquiries')
      .select('id,customer_name,phone,loan_category,status,follow_up_date,requested_amount')
      .not('follow_up_date', 'is', null)
      .order('follow_up_date', { ascending: true }).limit(500),
    ctx.client.from('loan_applications')
      .select('id,application_ref,customer_name,phone,loan_category,status,follow_up_date,requested_amount')
      .not('follow_up_date', 'is', null)
      .order('follow_up_date', { ascending: true }).limit(500)
  ]);
  if (enqRes.error) throw enqRes.error;

  const today = todayISO();
  const rows = [
    ...(enqRes.data || []).map((row) => ({ ...row, kind: 'enquiry' })),
    ...(appRes.data || []).map((row) => ({ ...row, kind: 'application' }))
  ].filter((row) => !['Rejected', 'Closed'].includes(row.status));

  const overdue = rows.filter((row) => row.follow_up_date < today);
  const dueToday = rows.filter((row) => row.follow_up_date === today);
  const upcoming = rows.filter((row) => row.follow_up_date > today && row.follow_up_date <= addDays(today, 30));
  const later = rows.filter((row) => row.follow_up_date > addDays(today, 30));

  const table = (list) => list.length
    ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Customer</th><th>Type</th><th>Loan</th><th>Status</th><th>Follow-up</th><th>Actions</th></tr></thead><tbody>${list.map((row) => `
      <tr>
        <td><strong>${esc(row.customer_name)}</strong><div class="muted">${esc(row.phone || '—')}</div></td>
        <td>${row.kind === 'application' ? `<span class="badge">App ${esc(row.application_ref || '')}</span>` : '<span class="badge">Enquiry</span>'}</td>
        <td>${esc(row.loan_category)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${fmtDate(row.follow_up_date)}</td>
        <td class="row-actions">
          <button class="btn btn--ghost btn--xs" data-follow-open="${esc(row.id)}" data-kind="${row.kind}">Open</button>
          <button class="btn btn--ghost btn--xs" data-follow-done="${esc(row.id)}" data-kind="${row.kind}">Clear date</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`
    : '<p class="muted">Nothing in this bucket.</p>';

  root.innerHTML = `
    <div class="cards">
      <div class="card card--stat card--static"><span class="muted">Overdue</span><strong class="${overdue.length ? 'is-danger' : ''}">${overdue.length}</strong><small>Needs attention first</small></div>
      <div class="card card--stat card--static"><span class="muted">Due today</span><strong>${dueToday.length}</strong><small>${fmtDate(today)}</small></div>
      <div class="card card--stat card--static"><span class="muted">Next 30 days</span><strong>${upcoming.length}</strong><small>Scheduled</small></div>
      <div class="card card--stat card--static"><span class="muted">Later</span><strong>${later.length}</strong><small>Beyond 30 days</small></div>
    </div>
    <section class="panel"><div class="panel__head"><div><h2>Overdue</h2><p>No automatic messages are sent. Contact is always an explicit admin action.</p></div></div>${table(overdue)}</section>
    <section class="panel"><div class="panel__head"><div><h2>Due today</h2></div></div>${table(dueToday)}</section>
    <section class="panel"><div class="panel__head"><div><h2>Upcoming (30 days)</h2></div></div>${table(upcoming)}</section>
    <section class="panel"><div class="panel__head"><div><h2>Later</h2></div></div>${table(later)}</section>`;

  root.querySelectorAll('[data-follow-open]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.kind === 'application') openApplication(button.dataset.followOpen);
      else openEnquiry(button.dataset.followOpen);
    });
  });
  root.querySelectorAll('[data-follow-done]').forEach((button) => {
    button.addEventListener('click', async () => {
      const table = button.dataset.kind === 'application' ? 'loan_applications' : 'customer_enquiries';
      const ok = await confirmDialog({
        title: 'Clear follow-up date',
        message: 'Remove the scheduled follow-up date? The customer record itself is kept.',
        confirmLabel: 'Clear date'
      });
      if (!ok) return;
      const { error } = await ctx.client.from(table).update({ follow_up_date: null }).eq('id', button.dataset.followDone);
      if (error) return toast(error.message, 'error');
      await logAction('clear_follow_up', table, button.dataset.followDone, {});
      toast('Follow-up date cleared.');
      await followupsView();
      refreshNavCounts();
    });
  });
}

/* -------------------------------------------------------- customer CRM */

function applyEnquiryFilters(query, s) {
  let q = query;
  if (s.status) q = q.eq('status', s.status);
  if (s.loan) q = q.eq('loan_category', s.loan);
  if (s.from) q = q.gte('submitted_at', `${s.from}T00:00:00`);
  if (s.to) q = q.lte('submitted_at', `${s.to}T23:59:59.999`);
  const term = s.search.trim().replace(/[,()%]/g, ' ').trim();
  if (term) q = q.or(`customer_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  return q;
}

async function getDuplicateMap() {
  const { data, error } = await ctx.client
    .from('customer_enquiries')
    .select('id,customer_name,phone,email,submitted_at')
    .limit(5000);
  if (error) return new Map();

  const groups = new Map();
  const add = (key, row) => {
    if (!key) return;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  };
  (data || []).forEach((row) => {
    const phone = String(row.phone || '').replace(/\D/g, '');
    if (phone.length >= 10) add(`p:${phone}`, row);
    const email = String(row.email || '').trim().toLowerCase();
    if (email) add(`e:${email}`, row);
  });

  const map = new Map();
  groups.forEach((list) => {
    if (list.length < 2) return;
    list.forEach((row) => {
      const others = list.filter((other) => other.id !== row.id);
      const existing = map.get(row.id) || [];
      const merged = [...existing];
      others.forEach((other) => {
        if (!merged.some((item) => item.id === other.id)) merged.push(other);
      });
      map.set(row.id, merged);
    });
  });
  return map;
}

async function enquiriesView() {
  await getCategories();
  const s = state.enquiries;
  root.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div><h2>Customer enquiries</h2><p>Private CRM records. Public visitors can never read this table.</p></div>
        <div class="row-actions">
          <button class="btn btn--ghost btn--sm" data-enq-export="csv">Export CSV</button>
          <button class="btn btn--gold btn--sm" data-enq-export="xlsx">Export Excel</button>
        </div>
      </div>
      <div class="toolbar toolbar--grid">
        <label class="tool">Search
          <input id="enqSearch" type="search" placeholder="Name, phone or email" value="${esc(s.search)}">
        </label>
        <label class="tool">Status
          <select id="enqStatus">${statusOptions(s.status)}</select>
        </label>
        <label class="tool">Loan type
          <select id="enqLoan"><option value="">All loan types</option>${options(categoryCache || LOAN_TYPES, s.loan)}</select>
        </label>
        <label class="tool">From
          <input id="enqFrom" type="date" value="${esc(s.from)}">
        </label>
        <label class="tool">To
          <input id="enqTo" type="date" value="${esc(s.to)}">
        </label>
        <label class="tool">Sort
          <select id="enqSort">
            <option value="submitted_at|desc">Newest first</option>
            <option value="submitted_at|asc">Oldest first</option>
            <option value="customer_name|asc">Name A–Z</option>
            <option value="requested_amount|desc">Amount high–low</option>
            <option value="status|asc">Status</option>
            <option value="follow_up_date|asc">Follow-up soonest</option>
          </select>
        </label>
        <label class="tool tool--check"><input id="enqDup" type="checkbox"${s.duplicatesOnly ? ' checked' : ''}> Possible duplicates only</label>
        <div class="tool tool--actions">
          <button class="btn btn--gold" id="enqApply">Apply filters</button>
          <button class="btn btn--ghost" id="enqReset">Reset</button>
        </div>
      </div>
      <div id="enqTable"></div>
      <div id="enqPager" class="pager"></div>
    </section>`;

  const sortSelect = document.getElementById('enqSort');
  sortSelect.value = `${s.sort}|${s.asc ? 'asc' : 'desc'}`;

  document.getElementById('enqApply').addEventListener('click', () => {
    s.search = document.getElementById('enqSearch').value;
    s.status = document.getElementById('enqStatus').value;
    s.loan = document.getElementById('enqLoan').value;
    s.from = document.getElementById('enqFrom').value;
    s.to = document.getElementById('enqTo').value;
    s.duplicatesOnly = document.getElementById('enqDup').checked;
    const [sort, direction] = sortSelect.value.split('|');
    s.sort = sort;
    s.asc = direction === 'asc';
    s.page = 1;
    loadEnquiries();
  });
  document.getElementById('enqReset').addEventListener('click', () => {
    Object.assign(s, {
      page: 1, sort: 'submitted_at', asc: false, search: '', status: '',
      loan: '', from: '', to: '', duplicatesOnly: false
    });
    enquiriesView();
  });
  document.getElementById('enqSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') document.getElementById('enqApply').click();
  });
  root.querySelectorAll('[data-enq-export]').forEach((button) => {
    button.addEventListener('click', () => exportEnquiries(button.dataset.enqExport));
  });

  await loadEnquiries();
}

async function loadEnquiries() {
  const s = state.enquiries;
  const table = document.getElementById('enqTable');
  if (table) table.innerHTML = '<div class="sk sk--title"></div><div class="sk sk--row"></div><div class="sk sk--row"></div><div class="sk sk--row"></div>';

  let query = ctx.client.from('customer_enquiries').select('*', { count: 'exact' });
  query = applyEnquiryFilters(query, s);

  if (s.duplicatesOnly) {
    const { data, error } = await query.order(s.sort, { ascending: s.asc }).limit(5000);
    if (error) { toast(error.message, 'error'); if (table) table.innerHTML = errorPanel(error, 'Customer query failed.'); return; }
    s.dupMap = await getDuplicateMap();
    const filtered = (data || []).filter((row) => s.dupMap.has(row.id));
    s.count = filtered.length;
    s.rows = filtered.slice((s.page - 1) * s.size, s.page * s.size);
  } else {
    const from = (s.page - 1) * s.size;
    const to = s.page * s.size - 1;
    const { data, count, error } = await query.order(s.sort, { ascending: s.asc }).range(from, to);
    if (error) { toast(error.message, 'error'); if (table) table.innerHTML = errorPanel(error, 'Customer query failed.'); return; }
    s.rows = data || [];
    s.count = count || 0;
    s.dupMap = await getDuplicateMap();
  }
  renderEnquiryTable();
}

function renderEnquiryTable() {
  const s = state.enquiries;
  const table = document.getElementById('enqTable');
  const pager = document.getElementById('enqPager');
  if (!table) return;

  if (!s.rows.length) {
    table.innerHTML = emptyState(
      s.duplicatesOnly ? 'No duplicates found' : 'No enquiries match these filters',
      s.duplicatesOnly
        ? 'No matching phone or email groups were detected in the records you can access.'
        : 'Try a wider date range, clear the search, or wait for new enquiries.'
    );
  } else {
    table.innerHTML = `<div class="table-wrap"><table class="admin-table admin-table--crm">
      <thead><tr>
        <th>Customer</th><th>Phone</th><th>Loan type</th><th>Amount</th>
        <th>Enquiry date</th><th>Status</th><th>Follow-up</th><th>Actions</th>
      </tr></thead>
      <tbody>${s.rows.map((row) => {
        const duplicates = s.dupMap.get(row.id);
        return `<tr>
          <td>
            <strong>${esc(row.customer_name)}</strong>
            <div class="muted">${esc(row.email || '—')}</div>
            ${duplicates ? `<span class="badge badge--warn" title="Same phone or email appears in another enquiry">Possible duplicate</span>` : ''}
          </td>
          <td>${esc(row.phone || '—')}</td>
          <td>${esc(row.loan_category || '—')}</td>
          <td>${fmtMoney(row.requested_amount)}</td>
          <td>${fmtDate(row.submitted_at)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${fmtDate(row.follow_up_date)}</td>
          <td class="row-actions"><button class="btn btn--ghost btn--xs" data-open-enquiry="${esc(row.id)}">View / edit</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
    table.querySelectorAll('[data-open-enquiry]').forEach((button) => {
      button.addEventListener('click', () => openEnquiry(button.dataset.openEnquiry));
    });
  }

  const pages = Math.max(1, Math.ceil(s.count / s.size));
  if (pager) {
    pager.innerHTML = `
      <span>${fmtNumber(s.count)} record${s.count === 1 ? '' : 's'} · page ${s.page} of ${pages}</span>
      <div class="row-actions">
        <button class="btn btn--ghost btn--xs" data-page="prev"${s.page <= 1 ? ' disabled' : ''}>Previous</button>
        <button class="btn btn--ghost btn--xs" data-page="next"${s.page >= pages ? ' disabled' : ''}>Next</button>
      </div>`;
    pager.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
      if (s.page > 1) { s.page -= 1; loadEnquiries(); }
    });
    pager.querySelector('[data-page="next"]')?.addEventListener('click', () => {
      if (s.page < pages) { s.page += 1; loadEnquiries(); }
    });
  }
}

async function relatedEnquiries(row) {
  const phone = String(row.phone || '').replace(/\D/g, '');
  const email = String(row.email || '').trim();
  const results = new Map();
  const queries = [];
  if (phone) queries.push(ctx.client.from('customer_enquiries').select('id,customer_name,phone,email,submitted_at,status').eq('phone', row.phone).limit(20));
  if (email) queries.push(ctx.client.from('customer_enquiries').select('id,customer_name,phone,email,submitted_at,status').eq('email', email).limit(20));
  const settled = await Promise.all(queries);
  settled.forEach((res) => {
    (res.data || []).forEach((item) => {
      if (item.id !== row.id) results.set(item.id, item);
    });
  });
  return [...results.values()];
}

function historyTimeline(items) {
  if (!items || !items.length) return '<p class="muted">No history recorded yet. New status, note and follow-up changes are added automatically.</p>';
  return `<ol class="timeline">${items.map((item) => {
    const actor = item.admin_profiles?.full_name || item.admin_profiles?.email || 'System / public form';
    const label = item.event_type.replace(/_/g, ' ');
    const transition = item.status_from || item.status_to
      ? `<span class="timeline__transition">${esc(item.status_from || '—')} → ${esc(item.status_to || '—')}</span>`
      : '';
    return `<li>
      <span class="timeline__dot"></span>
      <div>
        <strong>${esc(label)}</strong> ${transition}
        <div class="muted">${esc(item.note || '')}</div>
        <small>${fmtDateTime(item.created_at)} · ${esc(actor)}</small>
      </div>
    </li>`;
  }).join('')}</ol>`;
}

async function openEnquiry(id) {
  const { data: row, error } = await ctx.client.from('customer_enquiries').select('*').eq('id', id).single();
  if (error || !row) return toast(error?.message || 'Enquiry not found.', 'error');

  let history = [];
  try {
    const res = await ctx.client.from('enquiry_history')
      .select('*, admin_profiles(full_name,email)')
      .eq('enquiry_id', id).order('created_at', { ascending: false }).limit(50);
    if (!res.error) history = res.data || [];
  } catch { /* history table may not be migrated yet */ }

  const related = await relatedEnquiries(row);
  const duplicateBanner = related.length
    ? `<div class="notice notice--warn"><strong>Possible duplicate${related.length > 1 ? 's' : ''}.</strong> Same phone/email appears in ${related.length} other record${related.length > 1 ? 's' : ''}.
        ${related.map((item) => `<button class="link-btn" data-related="${esc(item.id)}">${esc(item.customer_name)} · ${fmtDate(item.submitted_at)}</button>`).join(' ')}
      </div>`
    : '';

  const body = `
    ${duplicateBanner}
    <div class="profile-head">
      <div>
        <h3>${esc(row.customer_name)}</h3>
        <p class="muted">Received ${fmtDateTime(row.submitted_at)} · Source: ${esc(row.source_page || '—')}</p>
      </div>
      ${statusBadge(row.status)}
    </div>

    <form class="form-grid form-grid--admin" data-enquiry-form>
      <label>Customer name<input name="customer_name" value="${esc(row.customer_name || '')}" required></label>
      <label>Phone<input name="phone" value="${esc(row.phone || '')}" required></label>
      <label>Email<input name="email" type="email" value="${esc(row.email || '')}" required></label>
      <label>Loan category<input name="loan_category" value="${esc(row.loan_category || '')}" required></label>
      <label>Requested amount<input name="requested_amount" inputmode="numeric" value="${row.requested_amount ?? ''}"></label>
      <label>Employment type<input name="employment_type" value="${esc(row.employment_type || '')}"></label>
      <label>City / location<input name="city_location" value="${esc(row.city_location || '')}"></label>
      <label>Status<select name="status">${statusOptions(row.status, false)}</select></label>
      <label>Follow-up date<input name="follow_up_date" type="date" value="${row.follow_up_date || ''}"></label>
      <label class="form-grid__full">Enquiry message<textarea name="message" rows="3">${esc(row.message || '')}</textarea></label>
      <label class="form-grid__full">Private admin notes (never shown publicly)<textarea name="admin_notes" rows="4">${esc(row.admin_notes || '')}</textarea></label>
    </form>

    <div class="modal__actions modal__actions--split">
      <div class="row-actions">
        <button class="btn btn--gold" type="button" data-save>Save changes</button>
        <button class="btn btn--ghost" type="button" data-create-app>Create loan application</button>
      </div>
      <button class="btn btn--danger" type="button" data-delete>Delete enquiry</button>
    </div>

    <div class="detail-block">
      <h3>Enquiry history</h3>
      ${historyTimeline(history)}
    </div>`;

  const { close } = openModal({
    title: 'Customer profile',
    subtitle: 'Private record · authorized administrators only',
    body,
    wide: true,
    onMount: (modal) => {
      const form = modal.querySelector('[data-enquiry-form]');
      modal.querySelectorAll('[data-related]').forEach((button) => {
        button.addEventListener('click', () => { close(); openEnquiry(button.dataset.related); });
      });
      modal.querySelector('[data-save]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (!form.reportValidity()) return;
        setBusy(button, true, 'Saving…');
        const values = Object.fromEntries(new FormData(form).entries());
        const amount = String(values.requested_amount || '').replace(/[^\d.]/g, '');
        const payload = {
          customer_name: values.customer_name.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          loan_category: values.loan_category.trim(),
          requested_amount: amount ? Number(amount) : null,
          employment_type: values.employment_type.trim() || null,
          city_location: values.city_location.trim() || null,
          status: values.status,
          follow_up_date: values.follow_up_date || null,
          message: values.message.trim() || null,
          admin_notes: values.admin_notes.trim() || null
        };
        const { error: updateError } = await ctx.client.from('customer_enquiries').update(payload).eq('id', id);
        setBusy(button, false);
        if (updateError) return toast(updateError.message, 'error');
        await logAction('update_enquiry', 'customer_enquiries', id, { status: payload.status });
        toast('Enquiry updated.');
        close();
        loadEnquiries();
        refreshNavCounts();
      });

      modal.querySelector('[data-create-app]').addEventListener('click', () => {
        close();
        applicationForm({ enquiry: row });
      });

      modal.querySelector('[data-delete]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Delete enquiry',
          message: `Delete the enquiry for ${row.customer_name}? This cannot be undone. Related history and application links are also affected.`,
          confirmLabel: 'Delete permanently',
          danger: true
        });
        if (!ok) return;
        const { error: deleteError } = await ctx.client.from('customer_enquiries').delete().eq('id', id);
        if (deleteError) return toast(deleteError.message, 'error');
        await logAction('delete_enquiry', 'customer_enquiries', id, { name: row.customer_name });
        toast('Enquiry deleted.');
        close();
        loadEnquiries();
        refreshNavCounts();
      });
    }
  });
}

async function fetchEnquiryRowsForExport() {
  let query = ctx.client.from('customer_enquiries').select('*');
  query = applyEnquiryFilters(query, state.enquiries);
  const { data, error } = await query.order('submitted_at', { ascending: false }).limit(5000);
  if (error) throw error;
  return data || [];
}

async function exportEnquiries(type) {
  try {
    const rows = await fetchEnquiryRowsForExport();
    if (!rows.length) return toast('No records match the current filters.', 'error');

    const headers = [
      'Customer ID', 'Name', 'Phone', 'Email', 'Loan Type', 'Requested Amount',
      'Employment Type', 'Location', 'Enquiry Date', 'Status', 'Follow-up Date',
      'Admin Notes', 'Source'
    ];
    const data = rows.map((row) => [
      row.id, row.customer_name, row.phone, row.email, row.loan_category,
      row.requested_amount, row.employment_type || '', row.city_location || '',
      row.submitted_at, row.status, row.follow_up_date || '', row.admin_notes || '',
      row.source_page || ''
    ]);

    if (type === 'csv') {
      downloadCsv(headers, data, `as-financial-enquiries-${todayISO()}.csv`);
    } else {
      if (!window.XLSX) return toast('Excel library unavailable. Check the CDN and try CSV.', 'error');
      const wb = XLSX.utils.book_new();
      const ws = makeSheet(headers, data, {
        widths: [38, 22, 14, 28, 26, 16, 16, 18, 20, 16, 14, 40, 30],
        moneyCols: [5],
        dateCols: [8]
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Customer Enquiries');
      XLSX.writeFile(wb, `as-financial-enquiries-${todayISO()}.xlsx`, { cellDates: true });
    }
    await logAction('export', 'customer_enquiries', null, { type, count: rows.length, filters: { ...state.enquiries, dupMap: undefined, rows: undefined } });
    toast(`Exported ${rows.length} enquiries.`);
  } catch (error) {
    toast(error.message || 'Export failed.', 'error');
  }
}

/* ---------------------------------------------------- loan applications */

function applyApplicationFilters(query, s) {
  let q = query;
  if (s.status) q = q.eq('status', s.status);
  if (s.loan) q = q.eq('loan_category', s.loan);
  if (s.from) q = q.gte('application_date', `${s.from}T00:00:00`);
  if (s.to) q = q.lte('application_date', `${s.to}T23:59:59.999`);
  const term = s.search.trim().replace(/[,()%]/g, ' ').trim();
  if (term) q = q.or(`customer_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,application_ref.ilike.%${term}%`);
  return q;
}

async function applicationsView() {
  await Promise.all([getAdmins(), getCategories()]);
  const s = state.applications;
  root.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div><h2>Loan applications</h2><p>Separate records from enquiries. An enquiry is never treated as an approved application.</p></div>
        <div class="row-actions">
          <button class="btn btn--gold btn--sm" data-new-application>New application</button>
          <button class="btn btn--ghost btn--sm" data-app-export="xlsx">Export Excel</button>
        </div>
      </div>
      <div class="toolbar toolbar--grid">
        <label class="tool">Search<input id="appSearch" type="search" placeholder="Name, phone, email or reference" value="${esc(s.search)}"></label>
        <label class="tool">Status<select id="appStatus">${statusOptions(s.status)}</select></label>
        <label class="tool">Loan type<select id="appLoan"><option value="">All loan types</option>${options(categoryCache || LOAN_TYPES, s.loan)}</select></label>
        <label class="tool">From<input id="appFrom" type="date" value="${esc(s.from)}"></label>
        <label class="tool">To<input id="appTo" type="date" value="${esc(s.to)}"></label>
        <label class="tool">Sort
          <select id="appSort">
            <option value="application_date|desc">Newest first</option>
            <option value="application_date|asc">Oldest first</option>
            <option value="customer_name|asc">Name A–Z</option>
            <option value="requested_amount|desc">Amount high–low</option>
            <option value="status|asc">Status</option>
            <option value="follow_up_date|asc">Follow-up soonest</option>
          </select>
        </label>
        <div class="tool tool--actions">
          <button class="btn btn--gold" id="appApply">Apply filters</button>
          <button class="btn btn--ghost" id="appReset">Reset</button>
        </div>
      </div>
      <div id="appTable"></div>
      <div id="appPager" class="pager"></div>
    </section>`;

  const sortSelect = document.getElementById('appSort');
  sortSelect.value = `${s.sort}|${s.asc ? 'asc' : 'desc'}`;

  document.getElementById('appApply').addEventListener('click', () => {
    s.search = document.getElementById('appSearch').value;
    s.status = document.getElementById('appStatus').value;
    s.loan = document.getElementById('appLoan').value;
    s.from = document.getElementById('appFrom').value;
    s.to = document.getElementById('appTo').value;
    const [sort, direction] = sortSelect.value.split('|');
    s.sort = sort;
    s.asc = direction === 'asc';
    s.page = 1;
    loadApplications();
  });
  document.getElementById('appReset').addEventListener('click', () => {
    Object.assign(s, { page: 1, sort: 'application_date', asc: false, search: '', status: '', loan: '', from: '', to: '' });
    applicationsView();
  });
  document.getElementById('appSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') document.getElementById('appApply').click();
  });
  root.querySelector('[data-new-application]').addEventListener('click', () => applicationForm({}));
  root.querySelector('[data-app-export]').addEventListener('click', () => exportApplications());

  await loadApplications();
}

async function loadApplications() {
  const s = state.applications;
  const table = document.getElementById('appTable');
  if (table) table.innerHTML = '<div class="sk sk--title"></div><div class="sk sk--row"></div><div class="sk sk--row"></div>';

  let query = ctx.client.from('loan_applications').select('*, admin_profiles(full_name,email)', { count: 'exact' });
  query = applyApplicationFilters(query, s);
  const from = (s.page - 1) * s.size;
  const to = s.page * s.size - 1;
  let { data, count, error } = await query.order(s.sort, { ascending: s.asc }).range(from, to);

  if (error && /relationship|schema cache|Could not find/i.test(error.message || '')) {
    let fallback = ctx.client.from('loan_applications').select('*', { count: 'exact' });
    fallback = applyApplicationFilters(fallback, s);
    const retry = await fallback.order(s.sort, { ascending: s.asc }).range(from, to);
    data = retry.data;
    count = retry.count;
    error = retry.error;
  }

  if (error) {
    if (table) table.innerHTML = errorPanel(error, 'Application query failed.');
    return;
  }
  s.rows = data || [];
  s.count = count || 0;
  renderApplicationTable();
}

function renderApplicationTable() {
  const s = state.applications;
  const table = document.getElementById('appTable');
  const pager = document.getElementById('appPager');
  if (!table) return;
  const admins = adminCache || [];

  if (!s.rows.length) {
    table.innerHTML = emptyState('No applications found', 'Create an application from an enquiry or add one directly. Enquiries remain separate records.');
  } else {
    table.innerHTML = `<div class="table-wrap"><table class="admin-table admin-table--crm">
      <thead><tr><th>Reference</th><th>Customer</th><th>Loan</th><th>Amount</th><th>Date</th><th>Status</th><th>Assigned</th><th>Follow-up</th><th>Actions</th></tr></thead>
      <tbody>${s.rows.map((row) => {
        const assigned = row.admin_profiles?.full_name || row.admin_profiles?.email
          || admins.find((admin) => admin.id === row.assigned_admin)?.full_name
          || (row.assigned_admin ? 'Assigned admin' : 'Unassigned');
        return `<tr>
          <td class="mono">${esc(row.application_ref || row.id.slice(0, 8))}</td>
          <td><strong>${esc(row.customer_name)}</strong><div class="muted">${esc(row.phone || row.email || '—')}</div></td>
          <td>${esc(row.loan_category)}</td>
          <td>${fmtMoney(row.requested_amount)}</td>
          <td>${fmtDate(row.application_date)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${esc(assigned)}</td>
          <td>${fmtDate(row.follow_up_date)}</td>
          <td class="row-actions"><button class="btn btn--ghost btn--xs" data-open-application="${esc(row.id)}">View / edit</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
    table.querySelectorAll('[data-open-application]').forEach((button) => {
      button.addEventListener('click', () => openApplication(button.dataset.openApplication));
    });
  }

  const pages = Math.max(1, Math.ceil(s.count / s.size));
  if (pager) {
    pager.innerHTML = `
      <span>${fmtNumber(s.count)} application${s.count === 1 ? '' : 's'} · page ${s.page} of ${pages}</span>
      <div class="row-actions">
        <button class="btn btn--ghost btn--xs" data-page="prev"${s.page <= 1 ? ' disabled' : ''}>Previous</button>
        <button class="btn btn--ghost btn--xs" data-page="next"${s.page >= pages ? ' disabled' : ''}>Next</button>
      </div>`;
    pager.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
      if (s.page > 1) { s.page -= 1; loadApplications(); }
    });
    pager.querySelector('[data-page="next"]')?.addEventListener('click', () => {
      if (s.page < pages) { s.page += 1; loadApplications(); }
    });
  }
}

async function openApplication(id) {
  const { data: row, error } = await ctx.client.from('loan_applications').select('*').eq('id', id).single();
  if (error || !row) return toast(error?.message || 'Application not found.', 'error');
  let history = [];
  try {
    const res = await ctx.client.from('application_history')
      .select('*, admin_profiles(full_name,email)')
      .eq('application_id', id).order('created_at', { ascending: false }).limit(50);
    if (!res.error) history = res.data || [];
  } catch { /* history table may not be migrated yet */ }
  applicationForm({ application: row, history });
}

async function applicationForm({ enquiry = null, application = null, history = [] }) {
  const admins = await getAdmins();
  const categories = await getCategories();
  const isEdit = Boolean(application?.id);
  const source = application || enquiry || {};
  const prefillCategory = source.loan_category || '';
  const assigned = application?.assigned_admin || ctx.profile.id;

  const body = `
    ${enquiry ? `<div class="notice"><strong>Linked enquiry:</strong> ${esc(enquiry.customer_name)} · ${esc(enquiry.loan_category)} · ${fmtDate(enquiry.submitted_at)}. The enquiry record stays separate.</div>` : ''}
    <form class="form-grid form-grid--admin" data-application-form>
      <label>Customer name<input name="customer_name" value="${esc(source.customer_name || '')}" required></label>
      <label>Phone<input name="phone" value="${esc(source.phone || '')}"></label>
      <label>Email<input name="email" type="email" value="${esc(source.email || '')}"></label>
      <label>Loan category<input name="loan_category" list="loanCategoryList" value="${esc(prefillCategory)}" required>
        <datalist id="loanCategoryList">${options(categories)}</datalist>
      </label>
      <label>Requested amount<input name="requested_amount" inputmode="numeric" value="${source.requested_amount ?? ''}"></label>
      <label>Status<select name="status">${statusOptions(application?.status || 'New', false)}</select></label>
      <label>Assigned administrator
        <select name="assigned_admin">
          <option value="">Unassigned</option>
          ${admins.filter((admin) => admin.is_active !== false).map((admin) => `<option value="${esc(admin.id)}"${admin.id === assigned ? ' selected' : ''}>${esc(admin.full_name || admin.email || admin.id)}</option>`).join('')}
        </select>
      </label>
      <label>Follow-up date<input name="follow_up_date" type="date" value="${application?.follow_up_date || ''}"></label>
      <label class="form-grid__full">Internal notes<textarea name="notes" rows="4">${esc(application?.notes || '')}</textarea></label>
    </form>
    ${isEdit ? `<div class="detail-block"><h3>Application history</h3>${historyTimeline(history, 'application')}</div>` : ''}
    <div class="modal__actions modal__actions--split">
      <button class="btn btn--gold" type="button" data-save>${isEdit ? 'Save changes' : 'Create application'}</button>
      ${isEdit ? '<button class="btn btn--danger" type="button" data-delete>Delete application</button>' : ''}
    </div>`;

  const { close } = openModal({
    title: isEdit ? `Application ${application.application_ref || ''}` : 'New loan application',
    subtitle: 'Admin-only record. Approval is always decided by the lender.',
    body,
    wide: true,
    onMount: (modal) => {
      const form = modal.querySelector('[data-application-form]');
      modal.querySelector('[data-save]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (!form.reportValidity()) return;
        setBusy(button, true, 'Saving…');
        const values = Object.fromEntries(new FormData(form).entries());
        const amount = String(values.requested_amount || '').replace(/[^\d.]/g, '');
        const payload = {
          customer_name: values.customer_name.trim(),
          phone: values.phone.trim() || null,
          email: values.email.trim() || null,
          loan_category: values.loan_category.trim(),
          requested_amount: amount ? Number(amount) : null,
          status: values.status,
          assigned_admin: values.assigned_admin || null,
          follow_up_date: values.follow_up_date || null,
          notes: values.notes.trim() || null
        };
        let result;
        if (isEdit) {
          result = await ctx.client.from('loan_applications').update(payload).eq('id', application.id);
        } else {
          const ref = `AS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
          result = await ctx.client.from('loan_applications').insert({
            ...payload,
            application_ref: ref,
            enquiry_id: enquiry?.id || null
          }).select('id,application_ref').single();
        }
        setBusy(button, false);
        if (result.error) return toast(result.error.message, 'error');

        const newId = isEdit ? application.id : result.data?.id;
        await logAction(isEdit ? 'update_application' : 'create_application', 'loan_applications', newId, { status: payload.status });
        if (!isEdit && enquiry?.id) {
          try {
            await ctx.client.from('enquiry_history').insert({
              enquiry_id: enquiry.id,
              admin_id: ctx.profile.id,
              event_type: 'application_created',
              note: `Loan application created: ${result.data?.application_ref || newId}`
            });
          } catch { /* non-blocking */ }
        }
        toast(isEdit ? 'Application updated.' : 'Application created.');
        close();
        if (document.getElementById('appTable')) loadApplications();
        refreshNavCounts();
      });

      modal.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Delete application',
          message: `Delete application ${application.application_ref || ''}? This cannot be undone. The linked enquiry is kept.`,
          confirmLabel: 'Delete permanently',
          danger: true
        });
        if (!ok) return;
        const { error: deleteError } = await ctx.client.from('loan_applications').delete().eq('id', application.id);
        if (deleteError) return toast(deleteError.message, 'error');
        await logAction('delete_application', 'loan_applications', application.id, {});
        toast('Application deleted.');
        close();
        loadApplications();
      });
    }
  });
}

async function fetchApplicationRowsForExport() {
  let query = ctx.client.from('loan_applications').select('*');
  query = applyApplicationFilters(query, state.applications);
  const { data, error } = await query.order('application_date', { ascending: false }).limit(5000);
  if (error) throw error;
  return data || [];
}

async function exportApplications() {
  try {
    const rows = await fetchApplicationRowsForExport();
    if (!rows.length) return toast('No applications match the current filters.', 'error');
    if (!window.XLSX) return toast('Excel library unavailable. Check the CDN.', 'error');
    const admins = await getAdmins();
    const headers = ['Application ID', 'Reference', 'Customer', 'Phone', 'Email', 'Loan Type', 'Requested Amount', 'Application Date', 'Status', 'Assigned Administrator', 'Follow-up Date', 'Internal Notes', 'Linked Enquiry ID'];
    const data = rows.map((row) => [
      row.id, row.application_ref || '', row.customer_name, row.phone || '', row.email || '',
      row.loan_category, row.requested_amount, row.application_date, row.status,
      admins.find((admin) => admin.id === row.assigned_admin)?.full_name || '',
      row.follow_up_date || '', row.notes || '', row.enquiry_id || ''
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeSheet(headers, data, {
      widths: [38, 18, 22, 14, 28, 26, 16, 20, 16, 24, 14, 40, 38],
      moneyCols: [6],
      dateCols: [7]
    }), 'Loan Applications');
    XLSX.writeFile(wb, `as-financial-applications-${todayISO()}.xlsx`, { cellDates: true });
    await logAction('export', 'loan_applications', null, { type: 'xlsx', count: rows.length });
    toast(`Exported ${rows.length} applications.`);
  } catch (error) {
    toast(error.message || 'Export failed.', 'error');
  }
}

/* -------------------------------------------------------- loan categories */

async function categoriesView() {
  const [enqRes, appRes, contentRes] = await Promise.all([
    ctx.client.from('customer_enquiries').select('loan_category').limit(5000),
    ctx.client.from('loan_applications').select('loan_category').limit(5000),
    ctx.client.from('website_content').select('key,value').eq('key', 'services').maybeSingle()
  ]);
  if (enqRes.error) throw enqRes.error;

  const enquiryCounts = {};
  (enqRes.data || []).forEach((row) => {
    if (row.loan_category) enquiryCounts[row.loan_category] = (enquiryCounts[row.loan_category] || 0) + 1;
  });
  const applicationCounts = {};
  (appRes.data || []).forEach((row) => {
    if (row.loan_category) applicationCounts[row.loan_category] = (applicationCounts[row.loan_category] || 0) + 1;
  });

  const services = Array.isArray(contentRes.data?.value) && contentRes.data.value.length
    ? contentRes.data.value
    : staticServices.map((service) => ({ id: service.id, title: service.title, visible: true, order: 999 }));

  const rows = [...new Set([...Object.keys(enquiryCounts), ...Object.keys(applicationCounts), ...services.map((s) => s.title)])]
    .filter(Boolean)
    .sort((a, b) => (enquiryCounts[b] || 0) - (enquiryCounts[a] || 0) || a.localeCompare(b));

  root.innerHTML = `
    <div class="grid-2">
      <section class="panel">
        <div class="panel__head"><div><h2>Demand by loan category</h2><p>Counts come from recorded enquiries and applications only.</p></div></div>
        ${rows.length ? barList(rows.map((name) => ({ label: name, value: enquiryCounts[name] || 0 })).sort((a, b) => b.value - a.value).slice(0, 12), 'enquiries') : emptyState('No category data', 'Category demand appears after enquiries are recorded.')}
        <div class="table-wrap" style="margin-top:14px"><table class="admin-table"><thead><tr><th>Loan category</th><th>Enquiries</th><th>Applications</th></tr></thead><tbody>
          ${rows.map((name) => `<tr><td>${esc(name)}</td><td>${fmtNumber(enquiryCounts[name] || 0)}</td><td>${fmtNumber(applicationCounts[name] || 0)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No records.</td></tr>'}
        </tbody></table></div>
      </section>
      <section class="panel">
        <div class="panel__head"><div><h2>Public service visibility</h2><p>Control descriptions, order and visibility in Website Content.</p></div><button class="btn btn--gold btn--sm" data-goto="content">Edit services</button></div>
        <div class="table-wrap"><table class="admin-table"><thead><tr><th>Service</th><th>Visible</th><th>Order</th></tr></thead><tbody>
          ${services.map((service) => `<tr><td>${esc(service.title || service.id)}</td><td>${service.visible === false ? '<span class="badge badge--rejected">Hidden</span>' : '<span class="badge badge--approved">Visible</span>'}</td><td>${esc(service.order ?? '—')}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
    </div>`;
  root.querySelector('[data-goto="content"]')?.addEventListener('click', () => render('content'));
}

/* --------------------------------------------------------- bank management */

async function banksView() {
  const { data, error } = await ctx.client.from('banks').select('*').order('display_order', { ascending: true });
  if (error) throw error;
  const rows = data || [];

  root.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div><h2>Banks &amp; lenders</h2><p>Only upload logos you have the right to use. Never claim an official partnership without written confirmation.</p></div>
        <button class="btn btn--gold btn--sm" data-new-bank>Add lender</button>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Logo</th><th>Lender</th><th>Rate</th><th>Amount range</th><th>Fee</th><th>Order</th><th>Public</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        ${rows.map((row) => `<tr>
          <td>${row.logo_url ? `<img class="logo-thumb" src="${esc(row.logo_url)}" alt="${esc(row.name)} logo">` : `<span class="wordmark">${esc((row.name || 'L').split(/\s+/).map((w) => w[0]).join('').slice(0, 3))}</span>`}</td>
          <td><strong>${esc(row.name)}</strong><div class="muted">${esc(row.description || '')}</div></td>
          <td>${esc(row.interest_rate_text || '—')}</td>
          <td>${fmtMoney(row.min_loan_amount)} – ${fmtMoney(row.max_loan_amount)}</td>
          <td>${esc(row.processing_fee || '—')}</td>
          <td>${esc(row.display_order ?? '—')}</td>
          <td><button class="badge badge--toggle ${row.display_status ? 'badge--approved' : 'badge--rejected'}" data-toggle-bank="${esc(row.id)}" data-value="${row.display_status ? 'true' : 'false'}">${row.display_status ? 'Enabled' : 'Disabled'}</button></td>
          <td>${fmtDate(row.last_updated)}</td>
          <td class="row-actions">
            <button class="btn btn--ghost btn--xs" data-edit-bank="${esc(row.id)}">Edit</button>
            <button class="btn btn--danger btn--xs" data-delete-bank="${esc(row.id)}">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`
      : emptyState('No lenders configured', 'Add a lender, upload a genuine logo (PNG/JPEG/WebP, max 2 MB), and mark illustrative values until verified.')}
    </section>`;

  root.querySelector('[data-new-bank]').addEventListener('click', () => bankForm({}));
  root.querySelectorAll('[data-edit-bank]').forEach((button) => {
    button.addEventListener('click', () => bankForm(rows.find((row) => row.id === button.dataset.editBank)));
  });
  root.querySelectorAll('[data-toggle-bank]').forEach((button) => {
    button.addEventListener('click', async () => {
      const next = button.dataset.value !== 'true';
      const { error: toggleError } = await ctx.client.from('banks').update({ display_status: next }).eq('id', button.dataset.toggleBank);
      if (toggleError) return toast(toggleError.message, 'error');
      await logAction('toggle_bank', 'banks', button.dataset.toggleBank, { display_status: next });
      banksView();
    });
  });
  root.querySelectorAll('[data-delete-bank]').forEach((button) => {
    button.addEventListener('click', async () => {
      const bank = rows.find((row) => row.id === button.dataset.deleteBank);
      const ok = await confirmDialog({
        title: 'Delete lender',
        message: `Delete ${bank?.name || 'this lender'} and its stored logo? This cannot be undone.`,
        confirmLabel: 'Delete lender',
        danger: true
      });
      if (!ok) return;
      if (bank?.logo_path) {
        try { await ctx.client.storage.from(LOGO_BUCKET).remove([bank.logo_path]); } catch { /* non-blocking */ }
      }
      const { error: deleteError } = await ctx.client.from('banks').delete().eq('id', bank.id);
      if (deleteError) return toast(deleteError.message, 'error');
      await logAction('delete_bank', 'banks', bank.id, { name: bank.name });
      toast('Lender deleted.');
      banksView();
    });
  });
}

function bankForm(bank = {}) {
  const isEdit = Boolean(bank.id);
  const body = `
    <form class="form-grid form-grid--admin" data-bank-form>
      <label>Lender name<input name="name" value="${esc(bank.name || '')}" required></label>
      <label>Type<input name="type" value="${esc(bank.type || 'Lender')}" placeholder="Public / Private / Housing Finance"></label>
      <label>Interest rate text<input name="interest_rate_text" value="${esc(bank.interest_rate_text || '')}" placeholder="e.g. 8.50% p.a. (illustrative)"></label>
      <label>EMI per lakh<input name="emi_per_lakh" value="${esc(bank.emi_per_lakh || '')}" placeholder="e.g. ₹868"></label>
      <label>Minimum loan amount<input name="min_loan_amount" inputmode="numeric" value="${bank.min_loan_amount ?? ''}"></label>
      <label>Maximum loan amount<input name="max_loan_amount" inputmode="numeric" value="${bank.max_loan_amount ?? ''}"></label>
      <label>Processing fee<input name="processing_fee" value="${esc(bank.processing_fee || '')}"></label>
      <label>Minimum tenure<input name="min_tenure" value="${esc(bank.min_tenure || '')}" placeholder="e.g. 1 year"></label>
      <label>Maximum tenure<input name="max_tenure" value="${esc(bank.max_tenure || '')}" placeholder="e.g. 30 years"></label>
      <label>Website URL<input name="website_url" type="url" value="${esc(bank.website_url || '')}" placeholder="https://"></label>
      <label>Last updated<input name="last_updated" type="date" value="${bank.last_updated || todayISO()}"></label>
      <label>Display order<input name="display_order" type="number" min="0" step="1" value="${bank.display_order ?? 100}"></label>
      <label class="form-grid__full">Description<textarea name="description" rows="3">${esc(bank.description || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="display_status"${bank.display_status !== false ? ' checked' : ''}> Show on public website</label>
      <label class="check"><input type="checkbox" name="illustrative"${bank.illustrative !== false ? ' checked' : ''}> Values are illustrative / not verified lender terms</label>
      <div class="form-grid__full logo-editor">
        <div>
          <span class="label-text">Lender logo</span>
          <div class="logo-preview" data-logo-preview>
            ${bank.logo_url ? `<img src="${esc(bank.logo_url)}" alt="${esc(bank.name)} logo">` : '<span class="muted">No logo uploaded. A wordmark fallback is used.</span>'}
          </div>
          <input type="file" name="logo_file" accept="image/png,image/jpeg,image/webp" data-logo-file>
          <p class="muted">PNG, JPEG or WebP · max 2 MB. Do not upload trademarked logos without permission.</p>
          ${bank.logo_path ? `<label class="check"><input type="checkbox" name="remove_logo"> Remove existing logo on save</label>` : ''}
        </div>
      </div>
    </form>
    <div class="modal__actions"><button class="btn btn--gold" type="button" data-save>${isEdit ? 'Save lender' : 'Add lender'}</button></div>`;

  const { close } = openModal({
    title: isEdit ? `Edit ${bank.name}` : 'Add lender',
    subtitle: 'Public display is controlled by the display status toggle.',
    body,
    wide: true,
    onMount: (modal) => {
      const form = modal.querySelector('[data-bank-form]');
      const fileInput = modal.querySelector('[data-logo-file]');
      fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        const preview = modal.querySelector('[data-logo-preview]');
        if (!file || !preview) return;
        if (!LOGO_TYPES.includes(file.type)) {
          toast('Only PNG, JPEG or WebP images are allowed.', 'error');
          fileInput.value = '';
          return;
        }
        if (file.size > LOGO_MAX_BYTES) {
          toast('Logo must be 2 MB or smaller.', 'error');
          fileInput.value = '';
          return;
        }
        preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Selected logo preview">`;
      });

      modal.querySelector('[data-save]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (!form.reportValidity()) return;
        setBusy(button, true, 'Saving…');
        const values = Object.fromEntries(new FormData(form).entries());
        const file = fileInput?.files?.[0] || null;
        const removeLogo = Boolean(values.remove_logo);

        let logoPath = bank.logo_path || null;
        let logoUrl = bank.logo_url || null;

        try {
          if (removeLogo && logoPath) {
            await ctx.client.storage.from(LOGO_BUCKET).remove([logoPath]);
            logoPath = null;
            logoUrl = null;
          }
          if (file) {
            if (!LOGO_TYPES.includes(file.type)) throw new Error('Only PNG, JPEG or WebP images are allowed.');
            if (file.size > LOGO_MAX_BYTES) throw new Error('Logo must be 2 MB or smaller.');
            const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
            const path = `lenders/${slugify(values.name)}-${Date.now()}.${ext}`;
            const { error: uploadError } = await ctx.client.storage.from(LOGO_BUCKET).upload(path, file, {
              cacheControl: '3600', contentType: file.type, upsert: false
            });
            if (uploadError) throw new Error(`Logo upload failed: ${uploadError.message}. Confirm the bank-logos bucket and storage policies are configured.`);
            const { data: publicUrl } = ctx.client.storage.from(LOGO_BUCKET).getPublicUrl(path);
            const oldPath = logoPath;
            logoPath = path;
            logoUrl = publicUrl.publicUrl;
            if (oldPath && oldPath !== path) {
              try { await ctx.client.storage.from(LOGO_BUCKET).remove([oldPath]); } catch { /* non-blocking */ }
            }
          }
        } catch (error) {
          setBusy(button, false);
          return toast(error.message, 'error');
        }

        const numeric = (value) => {
          const cleaned = String(value || '').replace(/[^\d.]/g, '');
          return cleaned ? Number(cleaned) : null;
        };
        const payload = {
          name: values.name.trim(),
          type: values.type?.trim() || null,
          interest_rate_text: values.interest_rate_text?.trim() || null,
          emi_per_lakh: values.emi_per_lakh?.trim() || null,
          min_loan_amount: numeric(values.min_loan_amount),
          max_loan_amount: numeric(values.max_loan_amount),
          processing_fee: values.processing_fee?.trim() || null,
          min_tenure: values.min_tenure?.trim() || null,
          max_tenure: values.max_tenure?.trim() || null,
          website_url: values.website_url?.trim() || null,
          last_updated: values.last_updated || null,
          display_order: values.display_order ? Number(values.display_order) : 100,
          description: values.description?.trim() || null,
          display_status: Boolean(values.display_status),
          illustrative: Boolean(values.illustrative),
          logo_path: logoPath,
          logo_url: logoUrl
        };

        let result;
        if (isEdit) result = await ctx.client.from('banks').update(payload).eq('id', bank.id);
        else result = await ctx.client.from('banks').insert(payload);
        setBusy(button, false);
        if (result.error) return toast(result.error.message, 'error');
        await logAction(isEdit ? 'update_bank' : 'create_bank', 'banks', bank.id || null, { name: payload.name });
        toast(isEdit ? 'Lender updated.' : 'Lender added.');
        close();
        banksView();
      });
    }
  });
}

/* ------------------------------------------------------- interest rates */

async function ratesView() {
  const { data, error } = await ctx.client.from('interest_rates').select('*').order('last_updated', { ascending: false });
  if (error) throw error;
  const rows = data || [];

  root.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div><h2>Interest rates</h2><p>Clearly label illustrative values until verified lender terms are entered. Never guarantee approval or a rate.</p></div>
        <button class="btn btn--gold btn--sm" data-new-rate>Add rate</button>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Lender</th><th>Category</th><th>Rate range</th><th>Fee</th><th>Loan limits</th><th>Active</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        ${rows.map((row) => `<tr>
          <td><strong>${esc(row.lender_name)}</strong>${row.illustrative ? '<div class="muted">Illustrative</div>' : ''}</td>
          <td>${esc(row.loan_category || '—')}</td>
          <td>${row.min_rate ?? '—'}% – ${row.max_rate ?? '—'}%</td>
          <td>${esc(row.processing_fee || '—')}</td>
          <td>${fmtMoney(row.min_loan_amount)} – ${fmtMoney(row.max_loan_amount)}</td>
          <td><button class="badge badge--toggle ${row.active ? 'badge--approved' : 'badge--rejected'}" data-toggle-rate="${esc(row.id)}" data-value="${row.active ? 'true' : 'false'}">${row.active ? 'Active' : 'Inactive'}</button></td>
          <td>${fmtDate(row.last_updated)}</td>
          <td class="row-actions">
            <button class="btn btn--ghost btn--xs" data-edit-rate="${esc(row.id)}">Edit</button>
            <button class="btn btn--danger btn--xs" data-delete-rate="${esc(row.id)}">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`
      : emptyState('No rates configured', 'Add a rate, mark it illustrative until verified, and activate it for public display.')}
    </section>`;

  root.querySelector('[data-new-rate]').addEventListener('click', () => rateForm({}));
  root.querySelectorAll('[data-edit-rate]').forEach((button) => {
    button.addEventListener('click', () => rateForm(rows.find((row) => row.id === button.dataset.editRate)));
  });
  root.querySelectorAll('[data-toggle-rate]').forEach((button) => {
    button.addEventListener('click', async () => {
      const next = button.dataset.value !== 'true';
      const { error: toggleError } = await ctx.client.from('interest_rates').update({ active: next }).eq('id', button.dataset.toggleRate);
      if (toggleError) return toast(toggleError.message, 'error');
      await logAction('toggle_rate', 'interest_rates', button.dataset.toggleRate, { active: next });
      ratesView();
    });
  });
  root.querySelectorAll('[data-delete-rate]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete interest rate',
        message: 'Delete this rate record? This cannot be undone.',
        confirmLabel: 'Delete rate',
        danger: true
      });
      if (!ok) return;
      const { error: deleteError } = await ctx.client.from('interest_rates').delete().eq('id', button.dataset.deleteRate);
      if (deleteError) return toast(deleteError.message, 'error');
      await logAction('delete_rate', 'interest_rates', button.dataset.deleteRate, {});
      toast('Rate deleted.');
      ratesView();
    });
  });
}

function rateForm(rate = {}) {
  const isEdit = Boolean(rate.id);
  const body = `
    <form class="form-grid form-grid--admin" data-rate-form>
      <label>Lender name<input name="lender_name" value="${esc(rate.lender_name || '')}" required></label>
      <label>Loan category<input name="loan_category" list="rateCategoryList" value="${esc(rate.loan_category || '')}">
        <datalist id="rateCategoryList">${options(LOAN_TYPES)}</datalist>
      </label>
      <label>Minimum rate (%)<input name="min_rate" type="number" step="0.001" min="0" value="${rate.min_rate ?? ''}"></label>
      <label>Maximum rate (%)<input name="max_rate" type="number" step="0.001" min="0" value="${rate.max_rate ?? ''}"></label>
      <label>Processing fee<input name="processing_fee" value="${esc(rate.processing_fee || '')}"></label>
      <label>Minimum loan amount<input name="min_loan_amount" inputmode="numeric" value="${rate.min_loan_amount ?? ''}"></label>
      <label>Maximum loan amount<input name="max_loan_amount" inputmode="numeric" value="${rate.max_loan_amount ?? ''}"></label>
      <label>Minimum tenure<input name="min_tenure" value="${esc(rate.min_tenure || '')}"></label>
      <label>Maximum tenure<input name="max_tenure" value="${esc(rate.max_tenure || '')}"></label>
      <label>Last updated<input name="last_updated" type="date" value="${rate.last_updated || todayISO()}"></label>
      <label class="form-grid__full">Description<textarea name="description" rows="3">${esc(rate.description || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="active"${rate.active !== false ? ' checked' : ''}> Active / publicly readable</label>
      <label class="check"><input type="checkbox" name="illustrative"${rate.illustrative !== false ? ' checked' : ''}> Illustrative value (not verified)</label>
    </form>
    <div class="modal__actions"><button class="btn btn--gold" type="button" data-save>${isEdit ? 'Save rate' : 'Add rate'}</button></div>`;

  const { close } = openModal({
    title: isEdit ? `Edit rate · ${rate.lender_name}` : 'Add interest rate',
    subtitle: 'Rates are indicative until verified with the lender.',
    body,
    wide: true,
    onMount: (modal) => {
      const form = modal.querySelector('[data-rate-form]');
      modal.querySelector('[data-save]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (!form.reportValidity()) return;
        setBusy(button, true, 'Saving…');
        const values = Object.fromEntries(new FormData(form).entries());
        const numeric = (value) => {
          const cleaned = String(value || '').replace(/[^\d.]/g, '');
          return cleaned ? Number(cleaned) : null;
        };
        const payload = {
          lender_name: values.lender_name.trim(),
          loan_category: values.loan_category?.trim() || null,
          min_rate: numeric(values.min_rate),
          max_rate: numeric(values.max_rate),
          processing_fee: values.processing_fee?.trim() || null,
          min_loan_amount: numeric(values.min_loan_amount),
          max_loan_amount: numeric(values.max_loan_amount),
          min_tenure: values.min_tenure?.trim() || null,
          max_tenure: values.max_tenure?.trim() || null,
          last_updated: values.last_updated || null,
          description: values.description?.trim() || null,
          active: Boolean(values.active),
          illustrative: Boolean(values.illustrative)
        };
        const result = isEdit
          ? await ctx.client.from('interest_rates').update(payload).eq('id', rate.id)
          : await ctx.client.from('interest_rates').insert(payload);
        setBusy(button, false);
        if (result.error) return toast(result.error.message, 'error');
        await logAction(isEdit ? 'update_rate' : 'create_rate', 'interest_rates', rate.id || null, { lender: payload.lender_name });
        toast(isEdit ? 'Rate updated.' : 'Rate added.');
        close();
        ratesView();
      });
    }
  });
}

/* ------------------------------------------------------------- analytics */

function analyticsRange() {
  const s = state.analytics;
  const today = todayISO();
  if (s.preset === 'today') return { from: today, to: today, label: 'Today' };
  if (s.preset === 'yesterday') {
    const y = addDays(today, -1);
    return { from: y, to: y, label: 'Yesterday' };
  }
  if (s.preset === '7') return { from: addDays(today, -6), to: today, label: 'Last 7 days' };
  if (s.preset === '90') return { from: addDays(today, -89), to: today, label: 'Last 90 days' };
  if (s.preset === 'custom') {
    return {
      from: s.from || addDays(today, -29),
      to: s.to || today,
      label: `${fmtDate(s.from || addDays(today, -29))} – ${fmtDate(s.to || today)}`
    };
  }
  return { from: addDays(today, -29), to: today, label: 'Last 30 days' };
}

async function fetchAnalyticsRows(from, to) {
  const pageSize = 1000;
  const maxRows = 20000;
  let offset = 0;
  const rows = [];
  while (offset < maxRows) {
    const { data, error } = await ctx.client
      .from('website_analytics')
      .select('event_type,page_path,visitor_key,event_date,meta,created_at')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function summariseAnalytics(rows, from, to) {
  const pageViews = rows.filter((row) => row.event_type === 'page_view');
  const uniqueKeys = new Set(
    rows.filter((row) => row.event_type === 'unique_visit').map((row) => row.visitor_key).filter(Boolean)
  );
  if (!uniqueKeys.size) {
    pageViews.forEach((row) => { if (row.visitor_key) uniqueKeys.add(row.visitor_key); });
  }
  const enquiries = rows.filter((row) => row.event_type === 'enquiry_submit').length;
  const calculator = rows.filter((row) => row.event_type === 'calculator_interaction').length;
  const phone = rows.filter((row) => row.event_type === 'phone_click').length;
  const whatsapp = rows.filter((row) => row.event_type === 'whatsapp_click').length;
  const contact = rows.filter((row) => row.event_type === 'contact_click').length;
  const cta = rows.filter((row) => row.event_type === 'cta_click').length;

  const dailyMap = new Map();
  const monthlyMap = new Map();
  const pageMap = new Map();
  const categoryMap = new Map();
  const ensureDay = (date) => {
    if (!dailyMap.has(date)) dailyMap.set(date, { date, pv: 0, uv: 0, enq: 0, visitors: new Set() });
    return dailyMap.get(date);
  };

  rows.forEach((row) => {
    const day = ensureDay(row.event_date);
    if (row.event_type === 'page_view') day.pv += 1;
    if (row.event_type === 'unique_visit' && row.visitor_key) day.visitors.add(row.visitor_key);
    if (row.event_type === 'enquiry_submit') day.enq += 1;
    if (row.visitor_key) day.visitors.add(row.visitor_key);

    const month = String(row.event_date).slice(0, 7);
    if (!monthlyMap.has(month)) monthlyMap.set(month, { month, pv: 0, visitors: new Set() });
    const monthRow = monthlyMap.get(month);
    if (row.event_type === 'page_view') monthRow.pv += 1;
    if (row.visitor_key) monthRow.visitors.add(row.visitor_key);

    if (row.event_type === 'page_view' && row.page_path) {
      const clean = String(row.page_path).split('?')[0] || '/';
      pageMap.set(clean, (pageMap.get(clean) || 0) + 1);
    }
    const category = row.meta?.loan_category || row.meta?.service;
    if (category) categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    if (!category && row.page_path) {
      const match = String(row.page_path).match(/[?&]service=([^&]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
        categoryMap.set(decoded, (categoryMap.get(decoded) || 0) + 1);
      }
    }
  });

  const daily = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ ...row, uv: row.visitors.size }));

  const monthly = [...monthlyMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({ month: row.month, pv: row.pv, uv: row.visitors.size }));

  const pages = [...pageMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  const categories = [...categoryMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  return {
    from, to, totalEvents: rows.length, pageViews: pageViews.length,
    uniqueVisitors: uniqueKeys.size, enquiries, calculator, phone, whatsapp, contact, cta,
    conversion: uniqueKeys.size ? (enquiries / uniqueKeys.size) * 100 : 0,
    daily, monthly, pages, categories,
    topPage: pages[0]?.label || '—', topCategory: categories[0]?.label || '—'
  };
}

function lineChart(points, color = '#10264A') {
  if (!points.length) return '';
  const width = 720;
  const height = 220;
  const pad = { left: 42, right: 16, top: 18, bottom: 30 };
  const max = Math.max(1, ...points.map((point) => Number(point.value) || 0));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length > 1 ? index * step : innerW / 2);
    const y = pad.top + innerH - ((Number(point.value) || 0) / max) * innerH;
    return [x, y];
  });
  const path = coords.map((coord, index) => `${index ? 'L' : 'M'}${coord[0].toFixed(1)} ${coord[1].toFixed(1)}`).join(' ');
  const area = `${path} L${pad.left + innerW} ${pad.top + innerH} L${pad.left} ${pad.top + innerH} Z`;
  const ticks = [0, 0.5, 1].map((ratio) => {
    const y = pad.top + innerH - ratio * innerH;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="chart-grid"/><text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${Math.round(max * ratio)}</text>`;
  }).join('');
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const labels = points.map((point, index) => (index % labelStep === 0
    ? `<text x="${coords[index][0]}" y="${height - 8}" text-anchor="middle" class="chart-label">${esc(point.label)}</text>`
    : '')).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
    ${ticks}
    <path d="${area}" fill="${color}" opacity="0.08"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${coords.map((coord) => `<circle cx="${coord[0]}" cy="${coord[1]}" r="2.6" fill="${color}"/>`).join('')}
    ${labels}
  </svg>`;
}

function barList(items, unit = '') {
  if (!items.length) return emptyState('No data in this range', 'Real events will appear here once the public site records them.');
  const max = Math.max(1, ...items.map((item) => item.value));
  return `<div class="bar-list">${items.map((item) => `
    <div class="bar-row">
      <span class="bar-label" title="${esc(item.label)}">${esc(item.label)}</span>
      <span class="bar-track"><span style="width:${Math.max(2, (item.value / max) * 100).toFixed(1)}%"></span></span>
      <b>${fmtNumber(item.value)}${unit ? ` <small>${esc(unit)}</small>` : ''}</b>
    </div>`).join('')}</div>`;
}

async function analyticsView() {
  const s = state.analytics;
  const range = analyticsRange();
  root.innerHTML = `
    <section class="panel">
      <div class="panel__head"><div><h2>Visitor analytics</h2><p>First-party recorded events only. No fake numbers, no personal data, admin traffic excluded.</p></div>
        <button class="btn btn--ghost btn--sm" data-analytics-export>Download summary</button>
      </div>
      <div class="toolbar toolbar--analytics">
        <div class="segmented" role="group" aria-label="Date range">
          ${[['today', 'Today'], ['yesterday', 'Yesterday'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['custom', 'Custom']]
            .map(([key, label]) => `<button type="button" data-preset="${key}" class="${s.preset === key ? 'is-active' : ''}">${label}</button>`).join('')}
        </div>
        <label class="tool">From<input id="anFrom" type="date" value="${esc(s.from || range.from)}"></label>
        <label class="tool">To<input id="anTo" type="date" value="${esc(s.to || range.to)}"></label>
        <button class="btn btn--gold" id="anApply">Apply range</button>
      </div>
      <p class="muted">Showing <strong>${esc(range.label)}</strong>. Unique visitors are an estimate based on a random client-side key; they are not verified identities.</p>
    </section>
    <div id="analyticsBody">${skeleton(4, 4)}</div>`;

  root.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      s.preset = button.dataset.preset;
      if (s.preset !== 'custom') {
        const next = analyticsRange();
        s.from = next.from;
        s.to = next.to;
      }
      analyticsView();
    });
  });
  document.getElementById('anApply').addEventListener('click', () => {
    s.preset = 'custom';
    s.from = document.getElementById('anFrom').value || addDays(todayISO(), -29);
    s.to = document.getElementById('anTo').value || todayISO();
    if (s.from > s.to) return toast('The start date must be before the end date.', 'error');
    analyticsView();
  });
  root.querySelector('[data-analytics-export]').addEventListener('click', exportAnalyticsSummary);

  await loadAnalytics(range);
}

async function loadAnalytics(range) {
  const body = document.getElementById('analyticsBody');
  try {
    const cacheKey = `${range.from}:${range.to}`;
    let rows = analyticsCache.key === cacheKey ? analyticsCache.rows : null;
    if (!rows) {
      rows = await fetchAnalyticsRows(range.from, range.to);
      analyticsCache = { key: cacheKey, rows, summary: null };
    }
    const summary = summariseAnalytics(rows, range.from, range.to);
    state.analytics.summary = summary;
    state.analytics.rows = rows;

    if (!rows.length) {
      body.innerHTML = emptyState('No analytics recorded for this range', 'Open the public website (non-admin pages) to record real page views and interactions, then refresh this report.');
      return;
    }

    const dailyPoints = summary.daily.map((row) => ({ label: row.date.slice(5), value: row.pv }));
    const visitorPoints = summary.daily.map((row) => ({ label: row.date.slice(5), value: row.uv }));
    const enquiryPoints = summary.daily.map((row) => ({ label: row.date.slice(5), value: row.enq }));

    body.innerHTML = `
      <div class="cards cards--overview">
        <div class="card card--stat card--static"><span class="muted">Page views</span><strong>${fmtNumber(summary.pageViews)}</strong><small>Recorded page_view events</small></div>
        <div class="card card--stat card--static"><span class="muted">Unique visitors</span><strong>${fmtNumber(summary.uniqueVisitors)}</strong><small>Approximate estimate</small></div>
        <div class="card card--stat card--static"><span class="muted">Enquiries</span><strong>${fmtNumber(summary.enquiries)}</strong><small>Enquiry submissions</small></div>
        <div class="card card--stat card--static"><span class="muted">Enquiry conversion</span><strong>${summary.conversion.toFixed(1)}%</strong><small>Enquiries ÷ unique visitors</small></div>
        <div class="card card--stat card--static"><span class="muted">Calculator uses</span><strong>${fmtNumber(summary.calculator)}</strong><small>EMI interactions</small></div>
        <div class="card card--stat card--static"><span class="muted">Phone clicks</span><strong>${fmtNumber(summary.phone)}</strong><small>tel: link clicks</small></div>
        <div class="card card--stat card--static"><span class="muted">WhatsApp clicks</span><strong>${fmtNumber(summary.whatsapp)}</strong><small>wa.me link clicks</small></div>
        <div class="card card--stat card--static"><span class="muted">Other contact / CTA</span><strong>${fmtNumber(summary.contact + summary.cta)}</strong><small>Email, maps, CTA clicks</small></div>
      </div>

      <div class="grid-2">
        <section class="panel"><div class="panel__head"><div><h2>Visitors over time</h2><p>Approximate unique visitors per day.</p></div></div>${lineChart(visitorPoints, '#067647')}</section>
        <section class="panel"><div class="panel__head"><div><h2>Page views over time</h2><p>Recorded page_view events.</p></div></div>${lineChart(dailyPoints, '#10264A')}</section>
      </div>

      <div class="grid-2">
        <section class="panel"><div class="panel__head"><div><h2>Enquiries over time</h2><p>Confirmed enquiry submissions only.</p></div></div>${lineChart(enquiryPoints, '#B7791F')}</section>
        <section class="panel"><div class="panel__head"><div><h2>Most visited pages</h2><p>Top ${summary.pages.length} pages in this range.</p></div></div>${barList(summary.pages, 'views')}</section>
      </div>

      <div class="grid-2">
        <section class="panel"><div class="panel__head"><div><h2>Popular loan categories</h2><p>From enquiry/CTA metadata and service query strings.</p></div></div>${barList(summary.categories, 'events')}</section>
        <section class="panel"><div class="panel__head"><div><h2>Monthly visitors</h2><p>Page views and approximate unique visitors.</p></div></div>
          <div class="table-wrap"><table class="admin-table"><thead><tr><th>Month</th><th>Page views</th><th>Unique visitors</th></tr></thead><tbody>
            ${summary.monthly.map((row) => `<tr><td>${esc(row.month)}</td><td>${fmtNumber(row.pv)}</td><td>${fmtNumber(row.uv)}</td></tr>`).join('')}
          </tbody></table></div>
        </section>
      </div>

      <section class="panel"><div class="panel__head"><div><h2>Daily detail</h2><p>${esc(range.from)} to ${esc(range.to)} · ${fmtNumber(summary.totalEvents)} recorded events.</p></div></div>
        <div class="table-wrap table-wrap--tall"><table class="admin-table"><thead><tr><th>Date</th><th>Page views</th><th>Unique visitors</th><th>Enquiries</th></tr></thead><tbody>
          ${summary.daily.map((row) => `<tr><td>${esc(row.date)}</td><td>${fmtNumber(row.pv)}</td><td>${fmtNumber(row.uv)}</td><td>${fmtNumber(row.enq)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>

      <section class="panel panel--note"><h3>Analytics limitations</h3>
        <ul>
          <li>Only events actually recorded in <code>website_analytics</code> are shown. There are no generated or estimated traffic numbers.</li>
          <li>Unique visitors use a random visitor key stored in the browser. Clearing storage or using another device/browser counts as a new visitor.</li>
          <li>Admin dashboard visits are excluded by the public tracker.</li>
          <li>No names, emails, phone numbers or precise locations are stored in analytics events.</li>
          <li>Privacy/cookie consent requirements depend on your jurisdiction; review before production.</li>
        </ul>
      </section>`;
  } catch (error) {
    body.innerHTML = errorPanel(error, 'Analytics query failed. Confirm the website_analytics table and RLS read policy.');
  }
}

async function exportAnalyticsSummary() {
  try {
    const summary = state.analytics.summary;
    if (!summary) return toast('Load an analytics range first.', 'error');
    if (!window.XLSX) return toast('Excel library unavailable. Check the CDN.', 'error');
    const wb = XLSX.utils.book_new();
    const metrics = [
      ['Range', `${summary.from} to ${summary.to}`],
      ['Page views', summary.pageViews],
      ['Unique visitors (approx.)', summary.uniqueVisitors],
      ['Enquiries', summary.enquiries],
      ['Enquiry conversion %', Number(summary.conversion.toFixed(1))],
      ['Calculator interactions', summary.calculator],
      ['Phone clicks', summary.phone],
      ['WhatsApp clicks', summary.whatsapp],
      ['Other contact clicks', summary.contact],
      ['CTA clicks', summary.cta],
      ['Top page', summary.topPage],
      ['Top loan category', summary.topCategory],
      ['Total recorded events', summary.totalEvents]
    ];
    const ws = XLSX.utils.aoa_to_sheet([['Metric', 'Value'], ...metrics]);
    ws['!cols'] = [{ wch: 32 }, { wch: 44 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Analytics Summary');

    const dailyHeaders = ['Date', 'Page Views', 'Unique Visitors', 'Enquiries'];
    const dailyRows = summary.daily.map((row) => [row.date, row.pv, row.uv, row.enq]);
    const dailyWs = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
    dailyWs['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
    dailyWs['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dailyRows.length, c: 3 } }) };
    XLSX.utils.book_append_sheet(wb, dailyWs, 'Analytics Daily');

    XLSX.writeFile(wb, `as-financial-analytics-${summary.from}-to-${summary.to}.xlsx`, { cellDates: true });
    await logAction('export', 'website_analytics', null, { type: 'xlsx', range: [summary.from, summary.to] });
    toast('Analytics summary downloaded.');
  } catch (error) {
    toast(error.message || 'Export failed.', 'error');
  }
}

/* --------------------------------------------------------- website content */

function contentField(field, value) {
  const name = field.name;
  const label = field.label;
  const current = value?.[name] ?? field.default ?? '';
  if (field.type === 'textarea') {
    return `<label class="form-grid__full">${esc(label)}<textarea name="${esc(name)}" rows="${field.rows || 3}" placeholder="${esc(field.placeholder || '')}">${esc(current)}</textarea></label>`;
  }
  if (field.type === 'checkbox') {
    const checked = value?.[name] ?? field.default ?? false;
    return `<label class="check"><input type="checkbox" name="${esc(name)}"${checked ? ' checked' : ''}> ${esc(label)}</label>`;
  }
  return `<label>${esc(label)}<input name="${esc(name)}" type="${esc(field.type || 'text')}" value="${esc(current)}" placeholder="${esc(field.placeholder || '')}"></label>`;
}

function contentCard(key, title, description, fields, value = {}) {
  return `<section class="panel" data-content-card="${esc(key)}">
    <div class="panel__head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><span class="badge">${esc(key)}</span></div>
    <form class="form-grid form-grid--admin" data-content-form="${esc(key)}">
      ${fields.map((field) => contentField(field, value)).join('')}
    </form>
    <div class="row-actions" style="margin-top:10px">
      <button class="btn btn--gold btn--sm" data-save-content="${esc(key)}">Save</button>
      <button class="btn btn--ghost btn--sm" data-cancel-content="${esc(key)}">Cancel</button>
    </div>
  </section>`;
}

async function saveContentValue(key, value, button) {
  setBusy(button, true, 'Saving…');
  const { error } = await ctx.client.from('website_content').upsert({
    key,
    value,
    is_public: true,
    updated_by: ctx.profile.id
  });
  setBusy(button, false);
  if (error) {
    toast(`${error.message}. Confirm the website_content table and admin RLS policy.`, 'error');
    return false;
  }
  try { sessionStorage.removeItem(CMS_CACHE_KEY); } catch { /* ignore */ }
  await logAction('update_content', 'website_content', null, { key });
  toast(`Saved “${key}”. Public pages use the new value after their 5-minute cache expires (or immediately with ?cms_preview=1).`);
  return true;
}

async function contentView() {
  const { data, error } = await ctx.client.from('website_content').select('*').order('key');
  if (error) throw error;
  const contentMap = Object.fromEntries((data || []).map((row) => [row.key, row.value || {}]));
  const services = Array.isArray(contentMap.services) && contentMap.services.length
    ? contentMap.services
    : staticServices.map((service, index) => ({
        id: service.id, title: service.title, description: service.description,
        tag: service.tag, icon: service.icon, image: service.image, alt: service.alt,
        details: service.details, cta: service.cta, visible: true, order: index + 1
      }));

  root.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div><h2>Live website content</h2><p>Changes are written to <code>website_content</code> (public rows) and reflected on public pages. Static content remains the fallback.</p></div>
        <div class="row-actions">
          <button class="btn btn--gold btn--sm" data-preview-site>Preview website</button>
          <button class="btn btn--ghost btn--sm" data-goto="export">Reports</button>
        </div>
      </div>
      <div class="notice">Only mark content public when it is safe for anyone to read. Customer records, notes and applications must never be placed here.</div>
    </section>

    <div class="grid-2">
      ${contentCard('hero', 'Homepage hero', 'Heading, supporting copy and small badge.', [
        { name: 'title', label: 'Heading (first part)' },
        { name: 'accent', label: 'Heading accent (italic)' },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'badge', label: 'Badge text' },
        { name: 'note', label: 'Small note under the hero', type: 'textarea', rows: 2 }
      ], contentMap.hero)}

      ${contentCard('contact', 'Contact details', 'Used across the public site and footer.', [
        { name: 'phone', label: 'Phone display', placeholder: '+91 91827 03079' },
        { name: 'phoneTel', label: 'Phone for tel: link', placeholder: '+919182703079' },
        { name: 'whatsapp', label: 'WhatsApp number (digits)', placeholder: '919182703079' },
        { name: 'email', label: 'Email address', type: 'email' },
        { name: 'address', label: 'Business address', type: 'textarea', rows: 2 },
        { name: 'tagline', label: 'Tagline' },
        { name: 'hoursNote', label: 'Opening hours note', type: 'textarea', rows: 2 }
      ], contentMap.contact)}

      ${contentCard('announcement', 'Announcement banner', 'Optional public banner. Disabled by default.', [
        { name: 'enabled', label: 'Show the announcement banner', type: 'checkbox', default: false },
        { name: 'text', label: 'Banner text', type: 'textarea', rows: 2 },
        { name: 'link', label: 'Optional link URL', placeholder: 'contact.html' },
        { name: 'label', label: 'Link label', placeholder: 'Learn more' }
      ], contentMap.announcement)}

      ${contentCard('footer', 'Footer content', 'Intro paragraph and financial disclaimer.', [
        { name: 'intro', label: 'Footer intro', type: 'textarea', rows: 3 },
        { name: 'disclaimer', label: 'Financial disclaimer', type: 'textarea', rows: 4 }
      ], contentMap.footer)}

      ${contentCard('site', 'Site settings', 'Lender information review date.', [
        { name: 'banksLastUpdated', label: 'Bank information last reviewed', placeholder: '07 Nov 2026' }
      ], contentMap.site)}
    </div>

    <section class="panel">
      <div class="panel__head"><div><h2>Services</h2><p>Edit descriptions, visibility and display order. Hidden services disappear from public service grids.</p></div>
        <div class="row-actions"><button class="btn btn--ghost btn--sm" data-add-service>Add service</button><button class="btn btn--gold btn--sm" data-save-services>Save services</button></div>
      </div>
      <div class="table-wrap"><table class="admin-table admin-table--services"><thead><tr><th>Title</th><th>Description</th><th>Tag</th><th>Order</th><th>Visible</th><th></th></tr></thead><tbody id="serviceRows">
        ${services.map((service, index) => `<tr data-service-row data-id="${esc(service.id || `service-${index}`)}">
          <td><input data-svc="title" value="${esc(service.title || '')}"></td>
          <td><textarea data-svc="description" rows="2">${esc(service.description || '')}</textarea></td>
          <td><input data-svc="tag" value="${esc(service.tag || '')}"></td>
          <td><input data-svc="order" type="number" min="0" step="1" value="${service.order ?? index + 1}" class="input-narrow"></td>
          <td><input data-svc="visible" type="checkbox"${service.visible !== false ? ' checked' : ''}></td>
          <td><button class="btn btn--danger btn--xs" data-remove-service>Remove</button></td>
        </tr>`).join('')}
      </tbody></table></div>
    </section>

    <section class="panel">
      <div class="panel__head"><div><h2>Advanced JSON</h2><p>For other public keys. Invalid JSON is rejected before saving.</p></div></div>
      <div class="form-grid form-grid--admin">
        <label>Key<input id="rawKey" placeholder="e.g. announcement"></label>
        <label class="check"><input type="checkbox" id="rawPublic" checked> Public readable</label>
        <label class="form-grid__full">JSON value<textarea id="rawValue" rows="8" placeholder='{"example": true}'></textarea></label>
      </div>
      <div class="row-actions" style="margin-top:10px">
        <button class="btn btn--gold btn--sm" data-save-raw>Save JSON</button>
      </div>
      <div class="table-wrap" style="margin-top:14px"><table class="admin-table"><thead><tr><th>Key</th><th>Public</th><th>Updated</th><th></th></tr></thead><tbody>
        ${(data || []).map((row) => `<tr><td class="mono">${esc(row.key)}</td><td>${row.is_public ? 'Yes' : 'No'}</td><td>${fmtDateTime(row.updated_at)}</td><td><button class="btn btn--ghost btn--xs" data-load-raw="${esc(row.key)}">Load</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No content keys yet.</td></tr>'}
      </tbody></table></div>
    </section>`;

  root.querySelector('[data-preview-site]').addEventListener('click', () => {
    window.open('../index.html?cms_preview=1', '_blank', 'noopener');
  });
  root.querySelector('[data-goto="export"]')?.addEventListener('click', () => render('export'));

  const fieldMap = {
    hero: [
      { name: 'title' }, { name: 'accent' }, { name: 'description' }, { name: 'badge' }, { name: 'note' }
    ],
    contact: [
      { name: 'phone' }, { name: 'phoneTel' }, { name: 'whatsapp' }, { name: 'email' },
      { name: 'address' }, { name: 'tagline' }, { name: 'hoursNote' }
    ],
    announcement: [
      { name: 'enabled', type: 'checkbox' }, { name: 'text' }, { name: 'link' }, { name: 'label' }
    ],
    footer: [{ name: 'intro' }, { name: 'disclaimer' }],
    site: [{ name: 'banksLastUpdated' }]
  };

  root.querySelectorAll('[data-save-content]').forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.dataset.saveContent;
      const form = root.querySelector(`[data-content-form="${key}"]`);
      if (!form) return;
      const values = Object.fromEntries(new FormData(form).entries());
      const value = {};
      (fieldMap[key] || []).forEach((field) => {
        if (field.type === 'checkbox') {
          value[field.name] = Boolean(form.querySelector(`[name="${field.name}"]`)?.checked);
        } else {
          value[field.name] = String(values[field.name] || '').trim();
        }
      });
      const saved = await saveContentValue(key, value, button);
      if (saved) contentView();
    });
  });

  root.querySelectorAll('[data-cancel-content]').forEach((button) => {
    button.addEventListener('click', () => contentView());
  });

  root.querySelectorAll('[data-remove-service]').forEach((button) => {
    button.addEventListener('click', () => button.closest('[data-service-row]')?.remove());
  });

  root.querySelector('[data-add-service]')?.addEventListener('click', () => {
    const tbody = document.getElementById('serviceRows');
    const row = document.createElement('tr');
    row.setAttribute('data-service-row', '');
    row.dataset.id = `custom-${Date.now()}`;
    row.innerHTML = `
      <td><input data-svc="title" placeholder="New service"></td>
      <td><textarea data-svc="description" rows="2" placeholder="Public description"></textarea></td>
      <td><input data-svc="tag" placeholder="Tag"></td>
      <td><input data-svc="order" type="number" min="0" step="1" value="999" class="input-narrow"></td>
      <td><input data-svc="visible" type="checkbox" checked></td>
      <td><button class="btn btn--danger btn--xs" data-remove-service>Remove</button></td>`;
    tbody.appendChild(row);
    row.querySelector('[data-remove-service]').addEventListener('click', () => row.remove());
  });

  root.querySelector('[data-save-services]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const rows = [...root.querySelectorAll('[data-service-row]')];
    const next = rows.map((row) => {
      const id = row.dataset.id;
      const base = services.find((service) => service.id === id) || {};
      const get = (field) => row.querySelector(`[data-svc="${field}"]`);
      return {
        ...base,
        id,
        title: get('title')?.value.trim() || base.title || 'Service',
        description: get('description')?.value.trim() || '',
        tag: get('tag')?.value.trim() || base.tag || 'Financial guidance',
        order: Number(get('order')?.value || 999),
        visible: Boolean(get('visible')?.checked)
      };
    }).filter((service) => service.title);
    const saved = await saveContentValue('services', next, button);
    if (saved) contentView();
  });

  root.querySelectorAll('[data-load-raw]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.loadRaw;
      const row = (data || []).find((item) => item.key === key);
      document.getElementById('rawKey').value = key;
      document.getElementById('rawValue').value = JSON.stringify(row?.value || {}, null, 2);
      document.getElementById('rawPublic').checked = row?.is_public !== false;
      document.getElementById('rawValue').focus();
    });
  });

  root.querySelector('[data-save-raw]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const key = document.getElementById('rawKey').value.trim();
    if (!key) return toast('Enter a content key.', 'error');
    let parsed;
    try {
      parsed = JSON.parse(document.getElementById('rawValue').value || '{}');
    } catch (error) {
      return toast(`Invalid JSON: ${error.message}`, 'error');
    }
    setBusy(button, true, 'Saving…');
    const { error } = await ctx.client.from('website_content').upsert({
      key,
      value: parsed,
      is_public: document.getElementById('rawPublic').checked,
      updated_by: ctx.profile.id
    });
    setBusy(button, false);
    if (error) return toast(error.message, 'error');
    try { sessionStorage.removeItem(CMS_CACHE_KEY); } catch { /* ignore */ }
    await logAction('update_content', 'website_content', null, { key, raw: true });
    toast(`Saved “${key}”.`);
    contentView();
  });
}

/* ------------------------------------------------------------ export reports */

function downloadCsv(headers, rows, filename) {
  const escapeCell = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), filename);
}

function makeSheet(headers, rows, options = {}) {
  const { widths = [], moneyCols = [], dateCols = [] } = options;
  const aoa = [
    headers,
    ...rows.map((row) =>
      row.map((value, index) => {
        if (dateCols.includes(index) && value) {
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? value : date;
        }
        if (moneyCols.includes(index) && value !== null && value !== undefined && value !== '') {
          const number = Number(value);
          return Number.isFinite(number) ? number : value;
        }
        return value ?? '';
      })
    )
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  if (widths.length) sheet['!cols'] = widths.map((width) => ({ wch: width }));
  if (headers.length) {
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(0, rows.length), c: headers.length - 1 }
      })
    };
  }
  moneyCols.forEach((column) => {
    for (let row = 1; row <= rows.length; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (sheet[address] && typeof sheet[address].v === 'number') sheet[address].z = '"₹"#,##0';
    }
  });
  dateCols.forEach((column) => {
    for (let row = 1; row <= rows.length; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (sheet[address]) sheet[address].z = 'yyyy-mm-dd hh:mm';
    }
  });
  return sheet;
}

async function exportView() {
  const from = addDays(todayISO(), -29);
  const to = todayISO();
  root.innerHTML = `
    <section class="panel">
      <div class="panel__head"><div><h2>Export reports</h2><p>Authorized admin data only. Customer files are confidential — store and share them securely.</p></div></div>
      <div class="toolbar toolbar--grid">
        <label class="tool">From<input id="exFrom" type="date" value="${from}"></label>
        <label class="tool">To<input id="exTo" type="date" value="${to}"></label>
        <label class="tool">Status<select id="exStatus">${statusOptions('')}</select></label>
        <label class="tool">Loan type<select id="exLoan"><option value="">All loan types</option>${options(LOAN_TYPES)}</select></label>
      </div>
      <div class="row-actions" style="margin-top:12px">
        <button class="btn btn--gold" data-export-workbook>Download full workbook (.xlsx)</button>
        <button class="btn btn--ghost" data-export-enq-csv>Customer enquiries (.csv)</button>
        <button class="btn btn--ghost" data-export-app-csv>Loan applications (.csv)</button>
      </div>
      <div class="notice" style="margin-top:14px">The workbook contains separate worksheets: Customer Enquiries, Loan Applications, Bank Information, Interest Rates and Analytics Summary. No passwords, tokens or service keys are included.</div>
      <div id="exportMsg" class="muted"></div>
    </section>`;

  const filters = () => ({
    from: document.getElementById('exFrom').value || from,
    to: document.getElementById('exTo').value || to,
    status: document.getElementById('exStatus').value,
    loan: document.getElementById('exLoan').value
  });

  root.querySelector('[data-export-workbook]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!window.XLSX) return toast('Excel library unavailable. Check the CDN.', 'error');
    setBusy(button, true, 'Building workbook…');
    try {
      const f = filters();
      if (f.from > f.to) throw new Error('The start date must be before the end date.');
      const [enqRes, appRes, bankRes, rateRes, analyticsRows] = await Promise.all([
        (() => {
          let q = ctx.client.from('customer_enquiries').select('*')
            .gte('submitted_at', `${f.from}T00:00:00`).lte('submitted_at', `${f.to}T23:59:59.999`);
          if (f.status) q = q.eq('status', f.status);
          if (f.loan) q = q.eq('loan_category', f.loan);
          return q.order('submitted_at', { ascending: false }).limit(5000);
        })(),
        (() => {
          let q = ctx.client.from('loan_applications').select('*')
            .gte('application_date', `${f.from}T00:00:00`).lte('application_date', `${f.to}T23:59:59.999`);
          if (f.status) q = q.eq('status', f.status);
          if (f.loan) q = q.eq('loan_category', f.loan);
          return q.order('application_date', { ascending: false }).limit(5000);
        })(),
        ctx.client.from('banks').select('*').order('display_order', { ascending: true }),
        ctx.client.from('interest_rates').select('*').order('last_updated', { ascending: false }),
        fetchAnalyticsRows(f.from, f.to)
      ]);
      if (enqRes.error) throw enqRes.error;
      if (appRes.error) throw appRes.error;
      if (bankRes.error) throw bankRes.error;
      if (rateRes.error) throw rateRes.error;

      const admins = await getAdmins();
      const enquiryHeaders = ['Customer ID', 'Name', 'Phone', 'Email', 'Loan Type', 'Requested Amount', 'Employment Type', 'Location', 'Enquiry Date', 'Status', 'Follow-up Date', 'Admin Notes', 'Source'];
      const enquiryRows = (enqRes.data || []).map((row) => [
        row.id, row.customer_name, row.phone, row.email, row.loan_category, row.requested_amount,
        row.employment_type || '', row.city_location || '', row.submitted_at, row.status,
        row.follow_up_date || '', row.admin_notes || '', row.source_page || ''
      ]);

      const appHeaders = ['Application ID', 'Reference', 'Customer', 'Phone', 'Email', 'Loan Type', 'Requested Amount', 'Application Date', 'Status', 'Assigned Administrator', 'Follow-up Date', 'Internal Notes', 'Linked Enquiry ID'];
      const appRows = (appRes.data || []).map((row) => [
        row.id, row.application_ref || '', row.customer_name, row.phone || '', row.email || '',
        row.loan_category, row.requested_amount, row.application_date, row.status,
        admins.find((admin) => admin.id === row.assigned_admin)?.full_name || '',
        row.follow_up_date || '', row.notes || '', row.enquiry_id || ''
      ]);

      const bankHeaders = ['Lender', 'Interest Rate', 'Min Loan Amount', 'Max Loan Amount', 'Processing Fee', 'Min Tenure', 'Max Tenure', 'EMI per Lakh', 'Description', 'Website', 'Last Updated', 'Public Display', 'Display Order', 'Illustrative'];
      const bankRows = (bankRes.data || []).map((row) => [
        row.name, row.interest_rate_text || '', row.min_loan_amount, row.max_loan_amount,
        row.processing_fee || '', row.min_tenure || '', row.max_tenure || '', row.emi_per_lakh || '',
        row.description || '', row.website_url || '', row.last_updated || '',
        row.display_status ? 'Yes' : 'No', row.display_order, row.illustrative ? 'Yes' : 'No'
      ]);

      const rateHeaders = ['Lender', 'Loan Category', 'Min Rate %', 'Max Rate %', 'Processing Fee', 'Min Loan Amount', 'Max Loan Amount', 'Min Tenure', 'Max Tenure', 'Description', 'Last Updated', 'Active', 'Illustrative'];
      const rateRows = (rateRes.data || []).map((row) => [
        row.lender_name, row.loan_category || '', row.min_rate, row.max_rate,
        row.processing_fee || '', row.min_loan_amount, row.max_loan_amount,
        row.min_tenure || '', row.max_tenure || '', row.description || '',
        row.last_updated || '', row.active ? 'Yes' : 'No', row.illustrative ? 'Yes' : 'No'
      ]);

      const summary = summariseAnalytics(analyticsRows, f.from, f.to);
      const summaryAoa = [
        ['AS Financial Services — Analytics Summary'],
        ['Range', `${f.from} to ${f.to}`],
        ['Generated', new Date().toLocaleString('en-IN')],
        [],
        ['Metric', 'Value'],
        ['Page views', summary.pageViews],
        ['Unique visitors (approx.)', summary.uniqueVisitors],
        ['Enquiries', summary.enquiries],
        ['Enquiry conversion %', Number(summary.conversion.toFixed(1))],
        ['Calculator interactions', summary.calculator],
        ['Phone clicks', summary.phone],
        ['WhatsApp clicks', summary.whatsapp],
        ['Other contact clicks', summary.contact],
        ['CTA clicks', summary.cta],
        ['Top page', summary.topPage],
        ['Top loan category', summary.topCategory],
        ['Total recorded events', summary.totalEvents],
        [],
        ['Date', 'Page Views', 'Unique Visitors', 'Enquiries'],
        ...summary.daily.map((row) => [row.date, row.pv, row.uv, row.enq])
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
      summaryWs['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, makeSheet(enquiryHeaders, enquiryRows, {
        widths: [38, 22, 14, 28, 26, 16, 16, 18, 20, 16, 14, 40, 30],
        moneyCols: [5], dateCols: [8]
      }), 'Customer Enquiries');
      XLSX.utils.book_append_sheet(wb, makeSheet(appHeaders, appRows, {
        widths: [38, 18, 22, 14, 28, 26, 16, 20, 16, 24, 14, 40, 38],
        moneyCols: [6], dateCols: [7]
      }), 'Loan Applications');
      XLSX.utils.book_append_sheet(wb, makeSheet(bankHeaders, bankRows, {
        widths: [26, 18, 16, 16, 18, 12, 12, 14, 34, 30, 14, 12, 12, 12],
        moneyCols: [2, 3], dateCols: [10]
      }), 'Bank Information');
      XLSX.utils.book_append_sheet(wb, makeSheet(rateHeaders, rateRows, {
        widths: [26, 26, 12, 12, 18, 16, 16, 12, 12, 34, 14, 10, 12],
        moneyCols: [5, 6], dateCols: [10]
      }), 'Interest Rates');
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Analytics Summary');

      XLSX.writeFile(wb, `AS-Financial-Reports-${f.from}-to-${f.to}.xlsx`, { cellDates: true });
      await logAction('export', 'reports', null, {
        type: 'xlsx', range: [f.from, f.to],
        counts: { enquiries: enquiryRows.length, applications: appRows.length, banks: bankRows.length, rates: rateRows.length }
      });
      document.getElementById('exportMsg').textContent = `Workbook downloaded: ${enquiryRows.length} enquiries, ${appRows.length} applications, ${bankRows.length} lenders, ${rateRows.length} rates.`;
      toast('Report workbook downloaded.');
    } catch (error) {
      toast(error.message || 'Workbook export failed.', 'error');
    } finally {
      setBusy(button, false);
    }
  });

  root.querySelector('[data-export-enq-csv]').addEventListener('click', async () => {
    try {
      const f = filters();
      let q = ctx.client.from('customer_enquiries').select('*')
        .gte('submitted_at', `${f.from}T00:00:00`).lte('submitted_at', `${f.to}T23:59:59.999`);
      if (f.status) q = q.eq('status', f.status);
      if (f.loan) q = q.eq('loan_category', f.loan);
      const { data, error } = await q.order('submitted_at', { ascending: false }).limit(5000);
      if (error) throw error;
      if (!(data || []).length) return toast('No enquiries in this range.', 'error');
      downloadCsv(
        ['Customer ID', 'Name', 'Phone', 'Email', 'Loan Type', 'Requested Amount', 'Employment Type', 'Location', 'Enquiry Date', 'Status', 'Follow-up Date', 'Admin Notes', 'Source'],
        (data || []).map((row) => [row.id, row.customer_name, row.phone, row.email, row.loan_category, row.requested_amount, row.employment_type || '', row.city_location || '', row.submitted_at, row.status, row.follow_up_date || '', row.admin_notes || '', row.source_page || '']),
        `as-financial-enquiries-${f.from}-to-${f.to}.csv`
      );
      await logAction('export', 'customer_enquiries', null, { type: 'csv', range: [f.from, f.to] });
      toast('Enquiries CSV downloaded.');
    } catch (error) {
      toast(error.message || 'CSV export failed.', 'error');
    }
  });

  root.querySelector('[data-export-app-csv]').addEventListener('click', async () => {
    try {
      const f = filters();
      let q = ctx.client.from('loan_applications').select('*')
        .gte('application_date', `${f.from}T00:00:00`).lte('application_date', `${f.to}T23:59:59.999`);
      if (f.status) q = q.eq('status', f.status);
      if (f.loan) q = q.eq('loan_category', f.loan);
      const { data, error } = await q.order('application_date', { ascending: false }).limit(5000);
      if (error) throw error;
      if (!(data || []).length) return toast('No applications in this range.', 'error');
      const admins = await getAdmins();
      downloadCsv(
        ['Application ID', 'Reference', 'Customer', 'Phone', 'Email', 'Loan Type', 'Requested Amount', 'Application Date', 'Status', 'Assigned Administrator', 'Follow-up Date', 'Internal Notes'],
        (data || []).map((row) => [row.id, row.application_ref || '', row.customer_name, row.phone || '', row.email || '', row.loan_category, row.requested_amount, row.application_date, row.status, admins.find((admin) => admin.id === row.assigned_admin)?.full_name || '', row.follow_up_date || '', row.notes || '']),
        `as-financial-applications-${f.from}-to-${f.to}.csv`
      );
      await logAction('export', 'loan_applications', null, { type: 'csv', range: [f.from, f.to] });
      toast('Applications CSV downloaded.');
    } catch (error) {
      toast(error.message || 'CSV export failed.', 'error');
    }
  });
}

/* ------------------------------------------------------------- activity logs */

async function logsView() {
  let data = [];
  let error = null;
  const res = await ctx.client.from('admin_activity_logs')
    .select('*, admin_profiles(full_name,email)')
    .order('created_at', { ascending: false }).limit(500);
  if (res.error && /relationship|schema cache|Could not find/i.test(res.error.message || '')) {
    const retry = await ctx.client.from('admin_activity_logs').select('*').order('created_at', { ascending: false }).limit(500);
    data = retry.data || [];
    error = retry.error;
  } else {
    data = res.data || [];
    error = res.error;
  }
  if (error) throw error;

  root.innerHTML = `
    <section class="panel">
      <div class="panel__head"><div><h2>Admin activity logs</h2><p>Logins, record changes, exports and content updates. No passwords or tokens are recorded.</p></div></div>
      <div class="toolbar"><label class="tool">Filter<input id="logSearch" type="search" placeholder="Action, entity or admin"></label></div>
      <div id="logTable"></div>
    </section>`;

  const paint = (term = '') => {
    const needle = term.trim().toLowerCase();
    const rows = data.filter((row) => !needle || [row.action, row.entity_type, row.admin_profiles?.full_name, row.admin_profiles?.email, JSON.stringify(row.details || {})].join(' ').toLowerCase().includes(needle));
    document.getElementById('logTable').innerHTML = rows.length
      ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>
          ${rows.map((row) => `<tr>
            <td>${fmtDateTime(row.created_at)}</td>
            <td>${esc(row.admin_profiles?.full_name || row.admin_profiles?.email || (row.admin_id ? 'Admin' : 'System'))}</td>
            <td><span class="badge">${esc(row.action)}</span></td>
            <td>${esc(row.entity_type || '—')}<div class="muted mono">${esc(String(row.entity_id || '').slice(0, 8))}</div></td>
            <td class="muted"><details><summary>View</summary><pre class="log-json">${esc(JSON.stringify(row.details || {}, null, 2))}</pre></details></td>
          </tr>`).join('')}</tbody></table></div>`
      : emptyState('No activity yet', 'Administrative actions will be logged here.');
  };
  paint();
  document.getElementById('logSearch').addEventListener('input', (event) => paint(event.target.value));
}

/* ---------------------------------------------------------------- settings */

async function settingsView() {
  const tables = [
    'admin_profiles', 'customer_enquiries', 'loan_applications', 'banks', 'interest_rates',
    'website_content', 'website_analytics', 'admin_activity_logs', 'enquiry_history', 'application_history'
  ];
  const checks = await Promise.all(tables.map(async (table) => {
    const result = await countRows(table);
    return { table, ok: !result.error, message: result.error?.message || '' };
  }));
  let storageOk = false;
  let storageMessage = '';
  try {
    const storage = await ctx.client.storage.from(LOGO_BUCKET).list('', { limit: 1 });
    storageOk = !storage.error;
    storageMessage = storage.error?.message || '';
  } catch (error) {
    storageMessage = error.message;
  }

  root.innerHTML = `
    <div class="grid-2">
      <section class="panel">
        <div class="panel__head"><div><h2>Signed-in administrator</h2><p>Session verified against <code>admin_profiles</code>.</p></div></div>
        <dl class="detail-list">
          <div><dt>Name</dt><dd>${esc(ctx.profile.full_name || '—')}</dd></div>
          <div><dt>Email</dt><dd>${esc(ctx.profile.email || ctx.session.user.email || '—')}</dd></div>
          <div><dt>Role</dt><dd>${esc(ctx.profile.role || 'admin')}</dd></div>
          <div><dt>User ID</dt><dd class="mono">${esc(ctx.profile.id)}</dd></div>
          <div><dt>Active</dt><dd>${ctx.profile.is_active ? '<span class="badge badge--approved">Yes</span>' : '<span class="badge badge--rejected">No</span>'}</dd></div>
        </dl>
        <div class="row-actions"><button class="btn btn--ghost" data-refresh-session>Refresh session</button><button class="btn btn--danger" data-signout>Sign out</button></div>
      </section>

      <section class="panel">
        <div class="panel__head"><div><h2>Backend health</h2><p>Read checks only. A missing table means a migration has not been applied.</p></div></div>
        <div class="table-wrap"><table class="admin-table"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>
          ${checks.map((check) => `<tr><td class="mono">${esc(check.table)}</td><td>${check.ok ? '<span class="badge badge--approved">OK</span>' : '<span class="badge badge--rejected">Missing / denied</span>'}</td><td class="muted">${esc(check.message)}</td></tr>`).join('')}
          <tr><td class="mono">storage:${esc(LOGO_BUCKET)}</td><td>${storageOk ? '<span class="badge badge--approved">OK</span>' : '<span class="badge badge--rejected">Missing / denied</span>'}</td><td class="muted">${esc(storageMessage)}</td></tr>
        </tbody></table></div>
      </section>
    </div>

    <section class="panel">
      <div class="panel__head"><div><h2>Setup checklist</h2><p>Complete these in your Supabase project before relying on live data.</p></div></div>
      <ol class="checklist">
        <li>Replace the placeholders in <code>js/supabase-config.js</code> with the project URL and <strong>anon/public</strong> key. Never use a service-role key in the browser.</li>
        <li>Run <code>20260507_000001_as_financial_admin.sql</code>, then <code>20260507_000002_cms_storage_history.sql</code> in the Supabase SQL editor.</li>
        <li>Create an Auth user and insert an active <code>admin_profiles</code> row for that user UUID. Public admin registration must stay disabled.</li>
        <li>Confirm the <code>bank-logos</code> storage bucket exists (PNG/JPEG/WebP, 2 MB limit) and the storage policies are present.</li>
        <li>Set Auth Site URL and password-reset redirect URLs for your deployed domain.</li>
        <li>Optional hardening: deploy <code>supabase/functions/submit-enquiry</code>, set <code>SUPABASE_ENQUIRY_FUNCTION</code>, and configure a Turnstile site/secret key.</li>
        <li>Review every RLS policy and storage policy in the Supabase dashboard. A hidden URL is not security.</li>
      </ol>
    </section>

    <section class="panel">
      <div class="panel__head"><div><h2>Security self-test</h2><p>Uses a temporary anonymous client to verify public reads are restricted. Results are indicative; also test from a private browser.</p></div><button class="btn btn--gold" data-security-test>Run anonymous checks</button></div>
      <div id="securityResults" class="muted">Not run yet.</div>
    </section>`;

  root.querySelector('[data-refresh-session]').addEventListener('click', async () => {
    const { data } = await ctx.client.auth.getSession();
    toast(data.session ? `Session active for ${data.session.user.email}` : 'No active session.', data.session ? 'info' : 'error');
  });
  root.querySelector('[data-signout]').addEventListener('click', async () => {
    await ctx.client.auth.signOut();
    location.href = './login.html';
  });

  root.querySelector('[data-security-test]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Testing…');
    try {
      const tests = await runSecuritySelfTest();
      document.getElementById('securityResults').innerHTML = `
        <div class="table-wrap"><table class="admin-table"><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>
          ${tests.map((test) => `<tr><td>${esc(test.name)}</td><td>${test.pass ? '<span class="badge badge--approved">Pass</span>' : '<span class="badge badge--rejected">Review</span>'}</td><td class="muted">${esc(test.detail || '')}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="muted" style="margin-top:10px">A pass means anonymous reads of private tables returned no rows or a permission error, while public content reads succeeded.</p>`;
    } catch (error) {
      document.getElementById('securityResults').innerHTML = `<p class="err">${esc(error.message)}</p>`;
    } finally {
      setBusy(button, false);
    }
  });
}

async function runSecuritySelfTest() {
  const cfg = await getConfig();
  if (!cfg) throw new Error('Supabase is not configured.');
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const anon = createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const tests = [];
  const checkPrivate = async (table, label) => {
    const res = await anon.from(table).select('id').limit(1);
    const rows = res.data || [];
    tests.push({
      name: label,
      pass: Boolean(res.error) || rows.length === 0,
      detail: res.error ? res.error.message : `${rows.length} row(s) visible anonymously`
    });
  };
  await checkPrivate('customer_enquiries', 'Anonymous read: customer enquiries blocked');
  await checkPrivate('loan_applications', 'Anonymous read: loan applications blocked');
  await checkPrivate('website_analytics', 'Anonymous read: analytics blocked');
  await checkPrivate('admin_activity_logs', 'Anonymous read: activity logs blocked');

  const banks = await anon.from('banks').select('id').limit(1);
  tests.push({ name: 'Anonymous read: public lenders allowed', pass: !banks.error, detail: banks.error?.message || 'Read succeeded' });
  const content = await anon.from('website_content').select('key').eq('is_public', true).limit(1);
  tests.push({ name: 'Anonymous read: public content allowed', pass: !content.error, detail: content.error?.message || 'Read succeeded' });
  const storage = await anon.storage.from(LOGO_BUCKET).list('', { limit: 1 });
  tests.push({ name: 'Anonymous read: public logo bucket', pass: !storage.error, detail: storage.error?.message || 'List succeeded' });
  return tests;
}

/* ------------------------------------------------------------------ boot */

boot();





