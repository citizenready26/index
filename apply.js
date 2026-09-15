// The Index — js/apply.js
// Lets a signed-in provider submit a service and see their own submissions,
// including pending/rejected ones that never appear in the public directory.

(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function showMessage(text, type) {
    const el = document.querySelector('[data-message]');
    el.textContent = text;
    el.className = `form-message ${type}`;
    el.hidden = false;
  }

  function renderMyServices(services) {
    const container = document.getElementById('my-services');
    if (!services.length) {
      container.innerHTML = '<div class="empty-state">You haven\'t submitted a service yet.</div>';
      return;
    }

    container.innerHTML = '<ul class="listing-registry"></ul>';
    const list = container.querySelector('.listing-registry');

    services.forEach((service) => {
      const li = document.createElement('li');
      li.className = 'listing-row';
      li.innerHTML = `
        <div class="listing-tag">${escapeHtml(service.category)}</div>
        <div class="listing-main">
          <p class="listing-title">${escapeHtml(service.title)}</p>
          <p class="listing-desc">${escapeHtml(service.description)}</p>
        </div>
        <div class="listing-status">
          <span class="status-pill status-${service.status}">${escapeHtml(service.status)}</span>
        </div>
      `;
      list.appendChild(li);
    });
  }

  async function loadMyServices(userId) {
    const { data, error } = await window.supabaseClient
      .from('services')
      .select('id, title, category, description, status, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      document.getElementById('my-services').innerHTML =
        `<div class="empty-state">Couldn't load your submissions. (${escapeHtml(error.message)})</div>`;
      return;
    }
    renderMyServices(data || []);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    window.refreshNav();

    const profile = await window.requireProfile();
    if (!profile) return; // requireProfile already redirected to auth.html

    loadMyServices(profile.id);

    document.querySelector('[data-panel="apply"]').addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        owner_id: profile.id,
        title: document.getElementById('service-title').value.trim(),
        category: document.getElementById('service-category').value.trim(),
        description: document.getElementById('service-description').value.trim(),
        website_url: document.getElementById('service-website').value.trim() || null,
        contact_info: document.getElementById('service-contact').value.trim(),
        status: 'pending',
      };

      const { error } = await window.supabaseClient.from('services').insert(payload);

      if (error) {
        showMessage(error.message, 'error');
        return;
      }

      showMessage('Submitted. An admin will review it shortly.', 'success');
      e.target.reset();
      loadMyServices(profile.id);
    });
  });
})();
