// Sign in and account creation. Business rules (validation, hashing, sessions) live in js/auth.js.
import { register, login, current, homeFor, authReady, ValidationError } from '../../js/auth.js';
import { store } from '../../js/store.js';
import { icon } from '../../js/icons.js';
import '../../js/ui.js'; // clears field errors as the user types

document.querySelectorAll('[data-icon]').forEach((i) => { i.outerHTML = icon(i.dataset.icon, 22); });
document.getElementById('backLink').insertAdjacentHTML('afterbegin', icon('arrowLeft', 16));

await authReady();
const next = new URLSearchParams(location.search).get('next');
const dest = /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(next || '') ? next : null;
const go = (user) => location.replace(dest || homeFor(user));
if (current()) go(current());
document.getElementById('signedOut').hidden = new URLSearchParams(location.search).get('signed-out') !== '1';

const copy = {
  in: ['Welcome back', 'Sign in to your seller or customer account.'],
  up: ['Create your account', 'Choose Artisan/Business (Seller) to sell your crafts, or Customer (Buyer) to order them.'],
};
const tabs = { in: [document.getElementById('tab-in'), document.getElementById('panel-in')],
               up: [document.getElementById('tab-up'), document.getElementById('panel-up')] };
function show(key) {
  for (const [k, [tab, panel]] of Object.entries(tabs)) {
    tab.setAttribute('aria-selected', k === key); panel.hidden = k !== key;
  }
  document.getElementById('authTitle').textContent = copy[key][0];
  document.getElementById('authLead').textContent = copy[key][1];
}
tabs.in[0].onclick = () => show('in');
tabs.up[0].onclick = () => show('up');
document.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => show(b.dataset.goto)));
// login.html#create opens a seller sign-up, login.html#create-customer opens a customer sign-up.
const fromHash = () => {
  if (location.hash === '#create' || location.hash === '#create-customer') {
    show('up'); upForm.elements.role.value = location.hash === '#create-customer' ? 'customer' : 'seller'; syncRole();
  }
};

// Show / hide password
document.querySelectorAll('[data-pw]').forEach((b) => {
  const input = document.getElementById(b.dataset.pw);
  const draw = () => { const shown = input.type === 'text'; b.innerHTML = icon(shown ? 'eyeOff' : 'eye', 18); b.setAttribute('aria-label', shown ? 'Hide password' : 'Show password'); };
  b.onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; draw(); };
  draw();
});

const upForm = tabs.up[1];
// The shop or business name only applies to sellers.
function syncRole() { document.getElementById('biz-field').hidden = upForm.elements.role.value !== 'seller'; }
upForm.addEventListener('change', syncRole);
syncRole(); fromHash();
window.addEventListener('hashchange', fromHash);

async function submit(form, action) {
  const btn = form.querySelector('button[type=submit]'), label = btn.textContent;
  const banner = form.querySelector('[data-form-error]');
  banner.textContent = '';
  form.querySelectorAll('.error').forEach((p) => (p.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  btn.disabled = true; btn.textContent = 'Please wait…';
  try { go(await action(Object.fromEntries(new FormData(form)))); }
  catch (err) {
    if (err instanceof ValidationError) {
      for (const [field, msg] of Object.entries(err.fields)) {
        const input = form.elements[field]; const p = document.getElementById('err-' + field);
        if (p) p.textContent = msg;
        if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
      }
      const first = form.querySelector('[aria-invalid=true]'); if (first) first.focus();
    } else banner.textContent = err.message;
    btn.disabled = false; btn.textContent = label;
  }
}
tabs.in[1].addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, (f) => login(f.email, f.password)); });
upForm.addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, register); });
