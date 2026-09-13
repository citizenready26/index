/* The Index — simple Supabase application */
let supabaseClient = null, currentUser = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const categories = ['Web & apps', 'Design & creative', 'Home & repair', 'Health & wellness', 'Business & professional', 'Education & tutoring', 'Events & entertainment', 'Other'];

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.classList.remove('show'), 3000);
}

function busy(btn, on, label) {
  if (!btn) return;
  btn.disabled = on;
  if (on) {
    btn.dataset.old = btn.textContent;
    btn.textContent = label || 'Please wait…';
  } else if (btn.dataset.old) {
    btn.textContent = btn.dataset.old;
  }
}

function normalizeUrl(v) {
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}

async function initSupabase() {
  if (!window.supabase || !window.THE_INDEX_SUPABASE_URL || !window.THE_INDEX_SUPABASE_KEY) return false;
  supabaseClient = window.supabase.createClient(window.THE_INDEX_SUPABASE_URL, window.THE_INDEX_SUPABASE_KEY);
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;
  supabaseClient.auth.onAuthStateChange((_e, s) => { currentUser = s?.user || null; });
  return true;
}

async function ensureProfile() {
  if (!currentUser) return;
  await supabaseClient.from('profiles').upsert({
    id: currentUser.id,
    name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Index member',
    email: currentUser.email
  }, { onConflict: 'id' });
}

function nextUrl() {
  const n = new URLSearchParams(location.search).get('next');
  return n && /^[a-zA-Z0-9._-]+\.html$/.test(n) ? n : 'dashboard.html';
}

/* ---------- Directory ---------- */

async function loadApproved() {
  const { data, error } = await supabaseClient
    .from('providers')
    .select('*, provider_photos(image_url,sort_order)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function providerCard(p) {
  const photos = (p.provider_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const cover = photos[0]?.image_url;
  const image = cover
    ? `<img src="${esc(cover)}" alt="${esc(p.name || '')}" loading="lazy">`
    : `<div class="image-placeholder" aria-hidden="true"><span>✦</span></div>`;
  return `<article class="listing-card"><a class="card-image ${cover ? '' : 'no-image'}" href="provider.html?id=${encodeURIComponent(p.id)}">${image}</a><div class="card-body"><div class="card-topline"><p>${esc(p.category || 'Other')}</p><span class="verified">✓ Verified</span></div><h3><a href="provider.html?id=${encodeURIComponent(p.id)}">${esc(p.name || 'Unnamed provider')}</a></h3><p class="card-desc">${esc(p.description || '')}</p><div class="card-footer"><span>${esc(p.location || 'Online')}</span><span>Verified provider</span></div></div></article>`;
}

async function initDirectory() {
  const grid = $('#listingGrid');
  if (!grid) return;
  const empty = $('#emptyState'), note = $('#resultsNote'), input = $('#directorySearch'), filter = $('#categoryFilter');
  let all = [];
  try {
    all = await loadApproved();
  } catch (e) {
    note.textContent = 'The directory could not be loaded right now.';
    return;
  }
  let q = '', cat = 'All';

  function render() {
    const rows = all.filter(p =>
      (cat === 'All' || p.category === cat) &&
      (`${p.name || ''} ${p.category || ''} ${p.description || ''} ${p.location || ''}`).toLowerCase().includes(q.toLowerCase())
    );
    grid.innerHTML = rows.map(providerCard).join('');
    empty.hidden = rows.length > 0;
    note.textContent = rows.length
      ? `${rows.length} ${rows.length === 1 ? 'business' : 'businesses'} to discover.`
      : (all.length ? 'No results for that search.' : 'The Index is just getting started — no approved providers yet.');
  }

  function search(v) {
    q = v;
    input.value = v;
    render();
    $('#directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#searchForm').onsubmit = e => { e.preventDefault(); search(input.value.trim()); };
  document.querySelectorAll('[data-search]').forEach(b => b.onclick = () => search(b.dataset.search));
  document.querySelectorAll('[data-category]').forEach(a => a.onclick = () => { cat = a.dataset.category; filter.value = cat; render(); });
  filter.onchange = () => { cat = filter.value; render(); };
  $('#clearSearch')?.addEventListener('click', () => {
    q = ''; cat = 'All'; input.value = ''; filter.value = 'All'; render();
  });
  render();
}

/* ---------- Auth ---------- */

async function initAuth() {
  if (!$('#authForm')) return;
  if (!supabaseClient) return;

  let mode = 'signin';
  const title = $('#authTitle'), sub = $('#authSubtitle'), submit = $('#authSubmit'),
    switcher = $('#switchAuth'), password = $('#authPassword'), message = $('#authMessage');

  function setMode(m) {
    mode = m;
    $('#authMode').value = m;
    title.textContent = m === 'signup' ? 'Create your account.' : 'Welcome back.';
    sub.textContent = m === 'signup'
      ? 'Create an account to submit and manage your listings.'
      : 'Sign in to manage your listings or submit a business.';
    submit.textContent = m === 'signup' ? 'Create account' : 'Sign in';
    switcher.textContent = m === 'signup' ? 'Already have an account? Sign in' : 'Create an account';
    password.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('#forgotPassword').hidden = m === 'signup';
  }
  setMode('signin');

  switcher.onclick = () => setMode(mode === 'signin' ? 'signup' : 'signin');

  $('#forgotPassword').onclick = async () => {
    const email = $('#authEmail').value.trim();
    if (!email) { message.textContent = 'Enter your email first.'; return; }
    const redirectTo = `${location.origin}${location.pathname.replace(/auth\.html$/, 'reset-password.html')}`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    message.textContent = error ? error.message : 'Password reset email sent. Check your inbox.';
  };

  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#authEmail').value.trim(), pw = password.value;
    busy(submit, true, mode === 'signup' ? 'Creating…' : 'Signing in…');
    const r = mode === 'signup'
      ? await supabaseClient.auth.signUp({ email, password: pw })
      : await supabaseClient.auth.signInWithPassword({ email, password: pw });
    busy(submit, false);
    if (r.error) { message.textContent = r.error.message; return; }
    if (mode === 'signup' && !r.data.session) {
      message.textContent = 'Check your inbox to confirm your account, then sign in.';
      return;
    }
    currentUser = r.data.user;
    await ensureProfile();
    location.href = nextUrl();
  };
}

async function initReset() {
  const form = $('#resetForm');
  if (!form || !supabaseClient) return;
  let recovery = false;
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') recovery = true;
  });
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) recovery = true;

  form.onsubmit = async e => {
    e.preventDefault();
    const a = $('#newPassword').value, b = $('#confirmPassword').value,
      msg = $('#resetMessage'), btn = $('#resetSubmit');
    if (a !== b) { msg.textContent = 'Passwords do not match.'; return; }
    if (!recovery) { msg.textContent = 'This recovery link is invalid or has expired. Request a new one.'; return; }
    busy(btn, true, 'Updating…');
    const { error } = await supabaseClient.auth.updateUser({ password: a });
    busy(btn, false);
    if (error) { msg.textContent = error.message; return; }
    msg.textContent = 'Password updated. You can sign in now.';
    await supabaseClient.auth.signOut();
  };
}

/* ---------- Photo upload ---------- */

async function uploadPhotos(providerId, files) {
  if (!files.length) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > 6 * 1024 * 1024) throw new Error('Each photo must be under 6 MB.');
    const path = `${currentUser.id}/${providerId}/${Date.now()}-${i}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabaseClient.storage.from('provider-photos').upload(path, f, { upsert: false });
    if (error) throw error;
    const { data } = supabaseClient.storage.from('provider-photos').getPublicUrl(path);
    const { error: rowError } = await supabaseClient.from('provider_photos').insert({
      provider_id: providerId,
      image_url: data.publicUrl,
      sort_order: i
    });
    if (rowError) throw rowError;
  }
}

/* ---------- Dashboard ---------- */

async function initDashboard() {
  const root = $('#dashboardRoot');
  if (!root) return;
  if (!currentUser) { location.href = 'auth.html?next=dashboard.html'; return; }
  await ensureProfile();

  $('#signOutButton').onclick = async () => {
    await supabaseClient.auth.signOut();
    location.href = 'index.html';
  };

  const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', currentUser.id).maybeSingle();
  if (profile?.role === 'admin') { $('#adminNav').hidden = false; }

  const { data: rows, error } = await supabaseClient
    .from('providers')
    .select('*')
    .eq('owner_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    root.innerHTML = `<div class="dashboard-empty"><h2>Could not load listings.</h2><p>${esc(error.message)}</p></div>`;
  } else if (!rows?.length) {
    root.innerHTML = '<div class="dashboard-empty"><h2>No listings yet.</h2><p>Your first submission will appear here while it is being reviewed.</p></div>';
  } else {
    root.innerHTML = `<div class="provider-list">${rows.map(p => `<article class="dashboard-card"><div><span class="status-pill status-${esc(p.status || 'pending')}">${esc(p.status || 'pending')}</span><h2>${esc(p.name)}</h2><p>${esc(p.category || 'Other')} · ${esc(p.location || 'Online')}</p><p class="muted-note">${esc(p.description || '')}</p></div><div class="dashboard-actions"><a class="arrow-link" href="provider.html?id=${encodeURIComponent(p.id)}">View →</a></div></article>`).join('')}</div>`;
  }
}

/* ---------- Provider profile page ---------- */

async function initProvider() {
  const root = $('#providerRoot');
  if (!root) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    root.innerHTML = '<div class="dashboard-empty"><h2>Provider not found.</h2><a class="button button-dark" href="index.html">Back to Index</a></div>';
    return;
  }

  const { data: p, error } = await supabaseClient
    .from('providers')
    .select('*, provider_photos(image_url,sort_order)')
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();

  if (error || !p) {
    root.innerHTML = '<div class="dashboard-empty"><h2>This provider is not available.</h2><p>It may still be under review.</p><a class="button button-dark" href="index.html">Back to Index</a></div>';
    return;
  }

  document.title = `${p.name} — The Index`;
  const website = p.website ? normalizeUrl(p.website) : '';
  const photos = (p.provider_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const heroPhoto = photos[0]?.image_url;

  root.innerHTML = `
<section class="profile-hero">
  <div class="profile-heading">
    <p class="eyebrow">${esc(p.category || 'Other')} <span class="dot">•</span> ${esc(p.location || 'Online')}</p>
    <div class="title-row"><h1>${esc(p.name)}</h1><span class="verified">✓ Verified</span></div>
    <p class="profile-lede">${esc(p.description || '')}</p>
  </div>
  <div class="hero-image">
    ${heroPhoto
      ? `<img src="${esc(heroPhoto)}" alt="${esc(p.name)}">`
      : `<div class="image-placeholder large"><span>✦</span></div>`}
  </div>
</section>
<section class="profile-layout">
  <div class="profile-content">
    <section><h2>About</h2><p>${esc(p.description || '')}</p></section>
    ${photos.length > 1
      ? `<section class="profile-gallery-section"><h2>Gallery</h2><div class="profile-gallery">${photos.slice(1).map(ph => `<img src="${esc(ph.image_url)}" alt="" loading="lazy">`).join('')}</div></section>`
      : ''}
  </div>
  <aside class="contact-card">
    <div class="availability"><i></i> Verified provider</div>
    <h3>Interested in this provider?</h3>
    <p>Use the provider's details below to get in touch.</p>
    ${website ? `<a class="button button-dark" href="${esc(website)}" target="_blank" rel="noopener">Visit website ↗</a>` : ''}
    <dl>
      <div><dt>Based in</dt><dd>${esc(p.location || '—')}</dd></div>
      <div><dt>Email</dt><dd>${p.contact_email ? `<a href="mailto:${esc(p.contact_email)}">${esc(p.contact_email)}</a>` : '—'}</dd></div>
      <div><dt>Phone</dt><dd>${p.contact_phone ? `<a href="tel:${esc(p.contact_phone)}">${esc(p.contact_phone)}</a>` : '—'}</dd></div>
    </dl>
  </aside>
</section>`;
}

/* ---------- Provider submission form ---------- */

async function initProviderForm() {
  const form = $('#providerForm');
  if (!form) return;
  if (!currentUser) { location.href = 'auth.html?next=dashboard.html'; return; }

  form.onsubmit = async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const files = Array.from($('#pPhotos').files || []);
    if (files.length > 4) { toast('Please choose no more than 4 photos.'); return; }

    const payload = {
      owner_id: currentUser.id,
      name: $('#pName').value.trim(),
      category: $('#pCategory').value,
      description: $('#pDescription').value.trim(),
      website: normalizeUrl($('#pWebsite').value.trim()),
      location: $('#pLocation').value.trim(),
      contact_email: $('#pEmail').value.trim() || null,
      contact_phone: $('#pPhone').value.trim() || null,
      status: 'pending'
    };
    if (!payload.name || !payload.description || !payload.website) {
      toast('Name, description and website are required.');
      return;
    }

    busy(btn, true, 'Submitting…');
    const { data, error } = await supabaseClient.from('providers').insert(payload).select().single();
    if (error) { busy(btn, false); toast(error.message); return; }

    try {
      await uploadPhotos(data.id, files);
    } catch (err) {
      console.warn(err);
      toast('Listing submitted, but one or more photos could not be uploaded.');
    }

    busy(btn, false);
    form.reset();
    toast('Submitted for review.');
    await initDashboard();
    location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

/* ---------- Admin ---------- */

function adminCard(p) {
  return `<article class="admin-card"><div class="admin-card-main"><div><span class="status-pill status-${esc(p.status || 'pending')}">${esc(p.status || 'pending')}</span><h2>${esc(p.name || 'Unnamed provider')}</h2><p>${esc(p.category || 'Other')} · ${esc(p.location || 'Online')}</p><p class="muted-note">${esc(p.description || '')}</p><p class="admin-meta">${esc(p.contact_email || 'No email')}${p.contact_phone ? ' · ' + esc(p.contact_phone) : ''}</p></div><div class="admin-actions"><a class="arrow-link" href="provider.html?id=${encodeURIComponent(p.id)}">View →</a>${p.status !== 'approved' ? `<button class="button button-dark" data-action="approve" data-id="${esc(p.id)}">Approve</button>` : ''}${p.status !== 'rejected' ? `<button class="button button-light" data-action="reject" data-id="${esc(p.id)}">Reject</button>` : ''}${p.status !== 'pending' ? `<button class="text-button" data-action="pending" data-id="${esc(p.id)}">Set pending</button>` : ''}<button class="text-button danger" data-action="delete" data-id="${esc(p.id)}">Delete</button></div></div></article>`;
}

async function initAdmin() {
  const root = $('#adminRoot');
  if (!root) return;
  if (!currentUser) { location.href = 'auth.html?next=admin.html'; return; }

  const { data: isAdmin, error: roleError } = await supabaseClient.rpc('is_admin');
  if (roleError || !isAdmin) {
    root.innerHTML = '<div class="dashboard-empty"><h2>Access denied.</h2><p>Your account does not have administrator access.</p><a class="button button-dark" href="index.html">Back to Index</a></div>';
    return;
  }

  $('#adminSignOut').onclick = async () => {
    await supabaseClient.auth.signOut();
    location.href = 'index.html';
  };

  async function render() {
    const { data, error } = await supabaseClient.from('providers').select('*').order('created_at', { ascending: false });
    if (error) {
      root.innerHTML = `<div class="dashboard-empty"><h2>Could not load listings.</h2><p>${esc(error.message)}</p></div>`;
      return;
    }
    const rows = data || [];
    const pending = rows.filter(x => x.status === 'pending').length;
    const approved = rows.filter(x => x.status === 'approved').length;
    const rejected = rows.filter(x => x.status === 'rejected').length;

    root.innerHTML = `<div class="admin-stats"><div><b>${rows.length}</b><span>Total</span></div><div><b>${pending}</b><span>Pending</span></div><div><b>${approved}</b><span>Approved</span></div><div><b>${rejected}</b><span>Rejected</span></div></div><div class="admin-toolbar"><button class="filter-chip active" data-filter="all">All</button><button class="filter-chip" data-filter="pending">Pending</button><button class="filter-chip" data-filter="approved">Approved</button><button class="filter-chip" data-filter="rejected">Rejected</button></div><div class="admin-list" id="adminList">${rows.map(adminCard).join('')}</div>`;

    function filter(s) {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === s));
      document.querySelectorAll('.admin-card').forEach(c => {
        const pill = c.querySelector('.status-pill');
        c.hidden = s !== 'all' && pill?.textContent !== s;
      });
    }
    document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => filter(b.dataset.filter));

    root.querySelectorAll('[data-action]').forEach(btn => btn.onclick = async () => {
      const id = btn.dataset.id, action = btn.dataset.action;
      if (action === 'delete' && !confirm('Delete this listing permanently?')) return;
      busy(btn, true, action === 'approve' ? 'Approving…' : action === 'reject' ? 'Rejecting…' : action === 'delete' ? 'Deleting…' : 'Saving…');
      let result;
      if (action === 'delete') {
        result = await supabaseClient.from('providers').delete().eq('id', id);
      } else {
        result = await supabaseClient.from('providers').update({
          status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending'
        }).eq('id', id);
      }
      busy(btn, false);
      if (result.error) { toast(result.error.message); return; }
      toast(action === 'delete'
        ? 'Listing deleted'
        : `Listing ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'set to pending'}.`);
      await render();
    });
  }
  render();
}

/* ---------- Boot ---------- */

async function init() {
  await initSupabase();
  await initAuth();
  await initReset();
  await initDirectory();
  await initDashboard();
  await initProviderForm();
  await initProvider();
  await initAdmin();
}

document.addEventListener('DOMContentLoaded', init);
