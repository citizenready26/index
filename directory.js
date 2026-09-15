// The Index — js/directory.js
// Loads approved services for the public homepage and filters them
// by a search box and category dropdown.

(function () {
  let allServices = [];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function render(services) {
    const grid = document.getElementById('services-grid');
    const count = document.getElementById('service-count');

    count.textContent = services.length
      ? `${services.length} approved service${services.length === 1 ? '' : 's'}`
      : '';

    if (!services.length) {
      grid.innerHTML = '<div class="empty-state">No services match yet. Try a different search or check back soon.</div>';
      return;
    }

    grid.innerHTML = '<ul class="listing-registry"></ul>';
    const list = grid.querySelector('.listing-registry');

    services.forEach((service) => {
      const li = document.createElement('li');
      li.className = 'listing-row';
      li.innerHTML = `
        <div class="listing-tag">${escapeHtml(service.category)}</div>
        <div class="listing-main">
          <p class="listing-title">${escapeHtml(service.title)} <span class="verified-mark">Verified</span></p>
          <p class="listing-desc">${escapeHtml(service.description)}</p>
          <p class="listing-links">
            ${service.website_url ? `<a href="${escapeHtml(service.website_url)}" target="_blank" rel="noopener">Visit site</a>` : ''}
            ${service.contact_info ? `<a href="mailto:${escapeHtml(service.contact_info)}">Contact</a>` : ''}
          </p>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function populateCategories(services) {
    const select = document.getElementById('category-filter');
    const categories = Array.from(new Set(services.map((s) => s.category))).sort();
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  function applyFilters() {
    const query = document.getElementById('service-search').value.trim().toLowerCase();
    const category = document.getElementById('category-filter').value;

    const filtered = allServices.filter((service) => {
      const matchesCategory = !category || service.category === category;
      const matchesQuery = !query ||
        service.title.toLowerCase().includes(query) ||
        (service.description || '').toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    render(filtered);
  }

  async function loadServices() {
    const grid = document.getElementById('services-grid');
    const { data, error } = await window.supabaseClient
      .from('services')
      .select('id, title, category, description, website_url, contact_info, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      grid.innerHTML = `<div class="empty-state">Couldn't load the directory right now. (${escapeHtml(error.message)})</div>`;
      return;
    }

    allServices = data || [];
    populateCategories(allServices);
    render(allServices);
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.refreshNav();
    loadServices();

    document.getElementById('service-search').addEventListener('input', applyFilters);
    document.getElementById('category-filter').addEventListener('change', applyFilters);
  });
})();
