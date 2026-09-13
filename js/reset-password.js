document.addEventListener('DOMContentLoaded', async () => {
  const notice = document.querySelector('#notice'), form = document.querySelector('#reset-form'), button = document.querySelector('#submit');
  const { data: { session } } = await db.auth.getSession();
  if (!session) setNotice(notice, 'Open this page only from the password-reset email link. Request a fresh link if this one has expired.', 'error');
  form.onsubmit = async event => { event.preventDefault(); const password = document.querySelector('#password').value; if (password !== document.querySelector('#confirm-password').value) return setNotice(notice, 'The passwords do not match.', 'error'); toggleBusy(button, true); const { error } = await db.auth.updateUser({ password }); toggleBusy(button, false); if (error) return setNotice(notice, error.message, 'error'); setNotice(notice, 'Password updated. You can now sign in.', 'success'); setTimeout(() => location.href = 'auth.html', 1400); };
});
