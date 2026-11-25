// Shared helpers: API calls, auth state, navbar
const API = '/api';

const Auth = {
  get token() { return localStorage.getItem('railsync_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('railsync_user') || 'null'); } catch { return null; } },
  save(token, user) { localStorage.setItem('railsync_token', token); localStorage.setItem('railsync_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('railsync_token'); localStorage.removeItem('railsync_user'); }
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
  const response = await fetch(API + path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Request failed');
  return payload;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function fmtTime(value) { return String(value || '').slice(0, 5); }
function fmtDuration(minutes) {
  const m = Number(minutes) || 0;
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}
function renderNav() {
  const user = Auth.user;
  document.getElementById('nav').innerHTML = `
    <a class="brand" href="/index.html">Rail<span>Sync</span></a>
    <div class="links">
      <a href="/index.html">Home</a>
      ${user ? '<a href="/pages/my-bookings.html">My Bookings</a>' : ''}
      ${user?.role === 'ADMIN' ? '<a href="/pages/admin-dashboard.html">Admin</a>' : ''}
      ${user ? '<a href="#" id="logout">Logout</a>' : '<a href="/pages/login.html">Login</a><a href="/pages/register.html">Register</a>'}
    </div>`;
  document.getElementById('logout')?.addEventListener('click', (event) => {
    event.preventDefault(); Auth.clear(); location.href = '/index.html';
  });
}
