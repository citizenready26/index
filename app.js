/* global supabase */
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const state = { client: null, user: null };

function client() {
  if (state.client) return state.client;
  const url = window.THE_INDEX_SUPABASE_URL;
  const key = window.THE_INDEX_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Add your Supabase project URL and anon key in config.js before using the live site.');
  state.client = supabase.createClient(url, key);
  return state.client;
}
function message(target, text, type = '') {
  if (!target) return;
  target.hidden = !text;
  target.textContent = text || '';
  target.className = `notice ${type}`;
}
function loading(target, value) { if (target) target.hidden = !value; }
function providerCard(p) {
  const image = p.image_url || 'assets/studio.jpg';
  const rating = Number(p.average_rating || 0).toFixed(1);
  return `<article class="listing-card"><a class="card-image" href="provider.html?id=${encodeURIComponent(p.id)}"><img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy"></a><div class="card-body"><div class="card-topline"><p>${esc(p.category || 'Independent business')}</p></div><h3><a href="provider.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3><p class="card-desc">${esc(p.description || '')}</p><div class="card-footer"><span>★ ${rating} <small>(${Number(p.review_count || 0)})</small></span><span>${esc(p.location || '')}</span></div></div></article>`;
}
async function getUser() { const { data } = await client().auth.getUser(); state.user = data.user || null; return state.user; }
async function requireUser() { const user = await getUser(); if (!user) { location.href = 'index.html?signin=1'; return null; } return user; }
async function isAdmin(user) {
  const { data, error } = await client().from('profiles').select('role').eq('id', user.id).single();
  if (error) throw error;
  return data?.role === 'admin';
}
async function loadDirectory() {
  const grid = $('#listingGrid'); if (!grid) return;
  const note = $('#resultsNote'); const empty = $('#emptyState');
  loading($('#directoryLoading'), true);
  try {
    const { data, error } = await client().from('providers').select('id,name,category,description,location,image_url,average_rating,review_count,status').eq('status', 'approved').order('created_at', { ascending: false });
    if (error) throw error;
    const providers = data || [];
    const render = () => {
      const term = $('#directorySearch')?.value.trim().toLowerCase() || '';
      const category = $('#categoryFilter')?.value || 'All';
      const filtered = providers.filter(p => (category === 'All' || p.category === category) && `${p.name} ${p.category} ${p.description} ${p.location}`.toLowerCase().includes(term));
      grid.innerHTML = filtered.map(providerCard).join(''); empty.hidden = filtered.length !== 0;
      note.textContent = filtered.length ? `${filtered.length} approved ${filtered.length === 1 ? 'business' : 'businesses'} to discover.` : 'No approved businesses match that search.';
    };
    $('#searchForm')?.addEventListener('submit', e => { e.preventDefault(); render(); });
    $('#categoryFilter')?.addEventListener('change', render); $('#clearSearch')?.addEventListener('click', () => { $('#directorySearch').value = ''; $('#categoryFilter').value = 'All'; render(); }); render();
  } catch (error) { message($('#directoryError'), error.message, 'error'); } finally { loading($('#directoryLoading'), false); }
}
async function loadProvider() {
  const root = $('#providerPage'); if (!root) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { message($('#providerError'), 'This provider link is missing an ID.', 'error'); return; }
  try {
    const { data: p, error } = await client().from('providers').select('*').eq('id', id).eq('status', 'approved').single();
    if (error) throw new Error('This listing is unavailable.');
    $('#providerName').textContent = p.name; $('#providerCategory').textContent = p.category || 'Independent business'; $('#providerLocation').textContent = p.location || '';
    $('#providerDescription').textContent = p.description || ''; $('#providerImage').src = p.image_url || 'assets/studio.jpg'; $('#providerWebsite').href = p.website || '#'; $('#providerWebsite').hidden = !p.website;
    $('#providerRating').textContent = `★ ${Number(p.average_rating || 0).toFixed(1)} (${Number(p.review_count || 0)} reviews)`;
    await loadReviews(id); bindReview(id);
  } catch (error) { message($('#providerError'), error.message, 'error'); } finally { loading($('#providerLoading'), false); }
}
async function loadReviews(providerId) {
  const list = $('#reviewList'); if (!list) return;
  const { data, error } = await client().from('reviews').select('rating,body,created_at,profiles(full_name)').eq('provider_id', providerId).order('created_at', { ascending: false });
  if (error) { message($('#reviewError'), 'Reviews are temporarily unavailable.', 'error'); return; }
  list.innerHTML = (data || []).map(r => `<blockquote><strong>${'★'.repeat(r.rating)}</strong><p>${esc(r.body)}</p><footer>${esc(r.profiles?.full_name || 'Index member')}</footer></blockquote>`).join('') || '<p>No reviews yet. Be the first to share your experience.</p>';
}
function bindReview(providerId) {
  $('#reviewForm')?.addEventListener('submit', async e => { e.preventDefault(); const user = await requireUser(); if (!user) return; const button = $('button[type="submit"]', e.currentTarget); button.disabled = true; message($('#reviewMessage'), 'Saving your review…');
    const form = new FormData(e.currentTarget); const { error } = await client().from('reviews').insert({ provider_id: providerId, user_id: user.id, rating: Number(form.get('rating')), body: form.get('body').trim() });
    button.disabled = false; if (error) return message($('#reviewMessage'), error.message, 'error'); e.currentTarget.reset(); message($('#reviewMessage'), 'Thank you — your review has been published.', 'success'); loadReviews(providerId);
  });
}
async function loadDashboard() {
  const user = await requireUser(); if (!user) return; loading($('#dashboardLoading'), true);
  try {
    const { data, error } = await client().from('providers').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }); if (error) throw error;
    const list = $('#ownerListings'); list.innerHTML = (data || []).map(p => `<article class="manage-card"><div><p class="status ${esc(p.status)}">${esc(p.status)}</p><h3>${esc(p.name)}</h3><p>${esc(p.category || '')} · ${esc(p.location || '')}</p></div><div><button data-edit="${p.id}">Edit</button><button data-delete="${p.id}" class="danger">Delete</button></div></article>`).join('') || '<p>You have no listings yet. Create one below.</p>';
    list.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => deleteListing(b.dataset.delete)); list.querySelectorAll('[data-edit]').forEach(b => editListing((data || []).find(p => p.id === b.dataset.edit)));
    $('#listingForm').onsubmit = e => saveListing(e, user); $('#photoInput').onchange = () => uploadPhoto(user); 
  } catch (error) { message($('#dashboardMessage'), error.message, 'error'); } finally { loading($('#dashboardLoading'), false); }
}
function editListing(p) { const f = $('#listingForm'); ['id','name','category','location','website','description'].forEach(k => f.elements[k].value = p[k] || ''); $('#formTitle').textContent = `Edit ${p.name}`; location.hash = 'listingForm'; }
async function saveListing(e, user) { e.preventDefault(); const f = e.currentTarget; const button = $('button[type="submit"]', f); button.disabled = true; const payload = Object.fromEntries(new FormData(f)); const id = payload.id; delete payload.id; payload.owner_id = user.id; if (!id) payload.status = 'pending';
  const query = id ? client().from('providers').update(payload).eq('id', id).eq('owner_id', user.id) : client().from('providers').insert(payload); const { error } = await query; button.disabled = false; if (error) return message($('#dashboardMessage'), error.message, 'error'); f.reset(); $('#formTitle').textContent = 'Create a listing'; message($('#dashboardMessage'), id ? 'Listing saved. Its moderation status is unchanged.' : 'Listing submitted for approval.', 'success'); loadDashboard();
}
async function deleteListing(id) { if (!confirm('Delete this listing? This cannot be undone.')) return; const { error } = await client().from('providers').delete().eq('id', id); if (error) return message($('#dashboardMessage'), error.message, 'error'); message($('#dashboardMessage'), 'Listing deleted.', 'success'); loadDashboard(); }
async function uploadPhoto(user) { const input = $('#photoInput'); const file = input.files[0]; const providerId = $('#listingForm').elements.id.value; if (!file || !providerId) return message($('#dashboardMessage'), 'Save the listing first, then upload a photo.', 'error'); if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return message($('#dashboardMessage'), 'Choose an image under 5 MB.', 'error'); const path = `${user.id}/${providerId}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi, '-')}`; message($('#dashboardMessage'), 'Uploading photo…'); const { error } = await client().storage.from('provider-photos').upload(path, file, { upsert: false }); if (error) return message($('#dashboardMessage'), error.message, 'error'); const { data } = client().storage.from('provider-photos').getPublicUrl(path); const result = await client().from('providers').update({ image_url: data.publicUrl }).eq('id', providerId).eq('owner_id', user.id); message($('#dashboardMessage'), result.error ? result.error.message : 'Photo uploaded and set as the listing image.', result.error ? 'error' : 'success'); }
async function loadAdmin() {
  const user = await requireUser(); if (!user) return; loading($('#adminLoading'), true);
  try { if (!(await isAdmin(user))) { $('#adminDenied').hidden = false; return; }
    $('#adminContent').hidden = false; const { data, error } = await client().from('providers').select('id,name,category,location,status,created_at,owner_id').order('created_at', { ascending: false }); if (error) throw error;
    const render = () => { const filter = $('#adminFilter').value; const rows = data.filter(p => filter === 'all' || p.status === filter); $('#adminListings').innerHTML = rows.map(p => `<article class="manage-card"><div><p class="status ${esc(p.status)}">${esc(p.status)}</p><h3>${esc(p.name)}</h3><p>${esc(p.category || '')} · ${esc(p.location || '')}</p></div><div class="admin-actions">${p.status !== 'approved' ? `<button data-status="approved" data-id="${p.id}">Approve</button>` : ''}${p.status !== 'rejected' ? `<button class="danger" data-status="rejected" data-id="${p.id}">Reject</button>` : ''}${p.status !== 'pending' ? `<button data-status="pending" data-id="${p.id}">Restore pending</button>` : ''}</div></article>`).join('') || '<p>No listings in this view.</p>'; $('#adminListings').querySelectorAll('[data-status]').forEach(b => b.onclick = () => moderate(b.dataset.id, b.dataset.status, render)); };
    $('#adminFilter').onchange = render; render();
  } catch (error) { message($('#adminMessage'), error.message, 'error'); } finally { loading($('#adminLoading'), false); }
}
async function moderate(id, status) { const { error } = await client().from('providers').update({ status }).eq('id', id); if (error) return message($('#adminMessage'), error.message, 'error'); message($('#adminMessage'), `Listing ${status}.`, 'success'); await loadAdmin(); message($('#adminMessage'), `Listing ${status}.`, 'success'); }
document.addEventListener('DOMContentLoaded', () => { loadDirectory(); loadProvider(); if ($('#ownerListings')) loadDashboard(); if ($('#adminListings')) loadAdmin(); });
