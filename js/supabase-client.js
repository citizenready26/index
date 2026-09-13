/* global supabase, INDEX_CONFIG */
window.db = supabase.createClient(INDEX_CONFIG.supabaseUrl, INDEX_CONFIG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

window.escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

window.setNotice = (element, message, type = 'info') => {
  if (!element) return;
  element.textContent = message;
  element.className = `notice ${type}`;
  element.hidden = !message;
};

window.toggleBusy = (button, busy, label) => {
  if (!button) return;
  if (busy) button.dataset.originalLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? (label || 'Please wait…') : (button.dataset.originalLabel || button.textContent);
};

window.requireUser = async () => {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    location.replace('auth.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'apply.html'));
    return null;
  }
  return user;
};

window.getProfile = async (id) => {
  const { data, error } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

window.isAdmin = async () => {
  const { data, error } = await db.rpc('is_admin');
  if (error) throw error;
  return data === true;
};

window.updateNav = async () => {
  const authLinks = document.querySelectorAll('[data-auth-link]');
  const adminLinks = document.querySelectorAll('[data-admin-link]');
  const { data: { user } } = await db.auth.getUser();
  authLinks.forEach(link => {
    link.textContent = user ? 'Sign out' : 'Sign in';
    link.href = user ? '#' : 'auth.html';
    link.onclick = user ? async event => { event.preventDefault(); await db.auth.signOut(); location.href = 'index.html'; } : null;
  });
  if (user) {
    try {
      const admin = await isAdmin();
      adminLinks.forEach(link => link.hidden = !admin);
    } catch (_) { adminLinks.forEach(link => link.hidden = true); }
  } else adminLinks.forEach(link => link.hidden = true);
};

document.addEventListener('DOMContentLoaded', updateNav);
