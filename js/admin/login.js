import { getClient, isBackendConfigured } from '../backend.js';

const msg = document.getElementById('msg');
const show = (t, err) => { msg.textContent=t; msg.className = 'notice' + (err?' err':''); msg.classList.remove('hide'); };
const params = new URLSearchParams(location.search);
if (params.get('err')==='unauthorized') show('Your account is not authorized for admin access.', true);
if (params.get('err')==='config') show('Supabase is not configured. Copy js/supabase-config.example.js to js/supabase-config.js.', true);

document.getElementById('showPw').addEventListener('change', e => { document.getElementById('password').type = e.target.checked ? 'text':'password'; });

const form = document.getElementById('loginForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    if (!(await isBackendConfigured())) { show('Supabase is not configured. Add js/supabase-config.js (URL + anon key).', true); return; }
    const client = await getClient();
    const email = form.email.value.trim(), password = form.password.value;
    if (!email || !password) { show('Enter email and password.', true); return; }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { show('Sign-in failed. Check your credentials.', true); return; }
    const { data: profile } = await client.from('admin_profiles').select('is_active').eq('id', data.user.id).maybeSingle();
    if (!profile?.is_active) { await client.auth.signOut(); show('Account is not an active administrator.', true); return; }
    try { await client.from('admin_activity_logs').insert({ admin_id: data.user.id, action:'login', details:{ via:'password' } }); } catch {}
    location.href = './dashboard.html';
  } finally { btn.disabled = false; btn.textContent = 'Sign in'; }
});

document.getElementById('forgotBtn').addEventListener('click', async () => {
  const email = form.email.value.trim();
  if (!email) { show('Enter your email first, then click Forgot password.', true); return; }
  if (!(await isBackendConfigured())) { show('Supabase is not configured.', true); return; }
  const client = await getClient();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/admin/login.html' });
  show(error ? 'Could not send reset email. Check configuration.' : 'If the account exists, a password reset email was sent.', !!error);
});