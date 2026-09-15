// The Index — js/auth.js
// Handles the sign in / sign up / forgot password tabs on auth.html.

(function () {
  function showMessage(text, type) {
    const el = document.querySelector('[data-message]');
    el.textContent = text;
    el.className = `form-message ${type}`;
    el.hidden = false;
  }

  function switchTab(tabName) {
    document.querySelectorAll('.form-tab').forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tabName;
    });
    document.querySelector('[data-message]').hidden = true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.refreshNav();

    document.querySelectorAll('.form-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Sign in
    document.querySelector('[data-panel="signin"]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;

      const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        showMessage(error.message, 'error');
        return;
      }
      window.location.href = 'apply.html';
    });

    // Sign up
    document.querySelector('[data-panel="signup"]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const businessName = document.getElementById('signup-business').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;

      const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { business_name: businessName } },
      });

      if (error) {
        showMessage(error.message, 'error');
        return;
      }

      // The handle_new_user trigger (see supabase/schema.sql) creates the
      // profiles row automatically using this business_name.
      if (data.session) {
        window.location.href = 'apply.html';
      } else {
        showMessage('Check your email to confirm your account, then sign in.', 'success');
        switchTab('signin');
      }
    });

    // Forgot password
    document.querySelector('[data-panel="forgot"]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value.trim();

      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.THE_INDEX_SITE_URL + 'reset-password.html',
      });

      if (error) {
        showMessage(error.message, 'error');
        return;
      }
      showMessage('If that email has an account, a reset link is on its way.', 'success');
    });
  });
})();
