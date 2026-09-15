document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('#services-grid'); const count = document.querySelector('#service-count');
  const { data: services, error } = await db.from('service_applications').select('id,service_name,category,description,city,website,image_path,approved_at').eq('status', 'approved').order('approved_at', { ascending: false });
  if (error) { grid.innerHTML = '<div class="empty">We could not load services right now. Please try again shortly.</div>'; return; }
  count.textContent = `${services.length} approved ${services.length === 1 ? 'service' : 'services'}`;
  if (!services.length) { grid.innerHTML = '<div class="empty">No services have been approved yet. Check back soon.</div>'; return; }
  grid.innerHTML = services.map(service => {
    const image = service.image_path ? db.storage.from(INDEX_CONFIG.storageBucket).getPublicUrl(service.image_path).data.publicUrl : '';
    const website = service.website ? `<p><a href="${escapeHtml(service.website)}" target="_blank" rel="noopener">Visit website ↗</a></p>` : '';
    return `<article class="card">${image ? `<img class="card-image" src="${image}" alt="">` : ''}<div class="card-body"><span class="pill">${escapeHtml(service.category)}</span><h3>${escapeHtml(service.service_name)}</h3><p>${escapeHtml(service.city)}</p><p>${escapeHtml(service.description)}</p>${website}</div></article>`;
  }).join('');
});
