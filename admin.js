// The Index — js/admin.js
// Lets a signed-in admin (profiles.role = 'admin') review services by
// status and approve or reject them. The real security boundary is the
// RLS policy + trigger in supabase/schema.sql — this page just calls
// .update(), and the database rejects it if the caller isn't an admin.

(function () {
  let currentStatus = 'pending';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderQueue(services) {
    const container = document.getElementById('admin-queue');

    if (!services.length) {
      container.innerHTML = `<div class="empty-state">Nothing in ${escapeHtml(currentStatus)}.</div>`;
      return;
    }

    container.innerHTML = '<ul class="listing-registry"></ul>';
    const list = container.querySelector('.listing-registry');

    services.forEach((service) => {
      const li = document.createElement('li');
      li.className = 'queue-row';

      const actions = currentStatus === 'pending'
        ? `<button class="button-link" data-approve="${service.id}">Approve</button>
           <button class="button-link danger" data-reject="${service.id}">Reject</button>`
        : currentStatus === 'approved'
          ? `<button class="button-link danger" data-reject="${service.id}">Reject</button>`
          : `<button class="button-link" data-approve="${service.id}">Approve</button>`;

      li.innerHTML = `
        <div class="queue-main">
          <p class="listing-title">${escapeHtml(service.title)} <span class="status-pill status-${service.status}">${escapeHtml(service.status)}</span></p>
          <p class="listing-desc">${escapeHtml(service.category)} — ${escapeHtml(service.description)}</p>
          <p class="field-hint">Contact: ${escapeHtml(service.contact_info)}${service.website_url ? ' · ' + escapeHtml(service.website_url) : ''}</p>
        </div>
        <div class="queue-actions">${actions}</div>
      `;
      list.appendChild(li);
    });

    list.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.approve, 'approved'));
    });
    list.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.reject, 'rejected'));
    });
  }

  async function loadQueue() {
    document.getElementById('admin-queue').innerHTML = '<p class="loading">Loading…</p>';

    const { data, error } = await window.supabaseClient
      .from('services')
      .select('id, title, category, description, website_url, contact_info, status, created_at')
      .eq('status', currentStatus)
      .order('created_at', { ascending: true });

    if (error) {
      document.getElementById('admin-queue').innerHTML =
        `<div class="empty-state">Couldn't load the queue. (${escapeHtml(error.message)})</div>`;
      return;
    }

    renderQueue(data || []);
  }

  async function updateStatus(id, status) {
    const { error } = await window.supabaseClient
      .from('services')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert(`Couldn't update this listing: ${error.message}`);
      return;
    }
    loadQueue();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    window.refreshNav();

    const profile = await window.requireProfile({ requireAdmin: true });
    if (!profile) return; // requireProfile already redirected

    loadQueue();

    document.querySelectorAll('.tab-strip button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-strip button').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        currentStatus = btn.dataset.status;
        loadQueue();
      });
    });
  });
})();
