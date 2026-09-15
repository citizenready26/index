// The Index — js/supabase-client.js
// Creates the shared Supabase client and small auth helpers every page uses.
// Load order matters: config.js, then the Supabase CDN script, then this file.

(function () {
  const cfg = window.THE_INDEX_CONFIG || {};

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseAnonKey.startsWith('PASTE-')) {
    console.error(
      'The Index: js/config.js is missing your Supabase URL/anon key. ' +
      'Open js/config.js and fill in supabaseUrl and supabaseAnonKey.'
    );
  }

  window.supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  // Redirect target used by password-reset emails.
  window.THE_INDEX_SITE_URL = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');

  /**
   * Fetches the signed-in user's profile row (id, role, business_name, ...).
   * Returns null if no one is signed in.
   */
  window.getCurrentProfile = async function () {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return null;
    const { data, error } = await window.supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error('Could not load profile:', error.message);
      return null;
    }
    return data;
  };

  /**
   * Updates the shared header nav for the current auth state:
   * shows "Sign in" when signed out, "My listings" + "Sign out" when signed in,
   * and reveals the Admin link only for admins.
   */
  window.refreshNav = async function () {
    const authLink = document.querySelector('[data-auth-link]');
    const adminLink = document.querySelector('[data-admin-link]');
    if (!authLink) return;

    const profile = await window.getCurrentProfile();

    if (!profile) {
      authLink.textContent = 'Sign in';
      authLink.setAttribute('href', 'auth.html');
      authLink.onclick = null;
      if (adminLink) adminLink.hidden = true;
      return;
    }

    authLink.textContent = 'Sign out';
    authLink.setAttribute('href', '#');
    authLink.onclick = async (e) => {
      e.preventDefault();
      await window.supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    };

    if (adminLink) adminLink.hidden = profile.role !== 'admin';
  };

  /**
   * Guards a page: redirects to auth.html if no one is signed in,
   * or to index.html if signed in but not an admin (when requireAdmin is true).
   * Returns the profile row on success.
   */
  window.requireProfile = async function ({ requireAdmin = false } = {}) {
    const profile = await window.getCurrentProfile();
    if (!profile) {
      window.location.href = 'auth.html';
      return null;
    }
    if (requireAdmin && profile.role !== 'admin') {
      window.location.href = 'index.html';
      return null;
    }
    return profile;
  };
})();
