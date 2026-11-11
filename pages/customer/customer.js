// Customer (Buyer) dashboard: order tracking, order history, made-to-order requests and profile.
import { store } from '../../js/store.js';
import { guard, roleLabel, updateProfile, current, ValidationError } from '../../js/auth.js';
import { siteHeader, siteFooter } from '../../js/layout.js';
import { esc, peso, date, toast, clearErrors, showErrors, $, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { STATUSES, ordersOf, ownerName } from '../../js/shop.js';
import { matches } from '../../js/filters.js';

const user = await guard(['customer']);
await siteHeader('customer.html');
siteFooter();
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, el.dataset.icon === 'search' ? 18 : 22); });
$('browse').insertAdjacentHTML('afterbegin', icon('store', 18));
$('role').textContent = roleLabel(user.role) + ' account';

const label = Object.fromEntries(STATUSES);
const tone = { pending: 'pill--gold', in_production: 'pill--info', ready: 'pill--warn', completed: 'pill--ok' };
const order = STATUSES.map(([k]) => k);
const day = (d) => date(d + 'T00:00');
const views = {
  active: (o) => o.status !== 'completed',
  ready: (o) => o.status === 'ready',
  mto: (o) => !!o.madeToOrder,
  completed: (o) => o.status === 'completed',
};

const track = (o) => {
  const at = order.indexOf(o.status);
  return `<ol class="track" aria-label="Order progress: ${label[o.status]}">${STATUSES.map(([k, v], i) =>
    `<li class="${i < at ? 'is-done' : i === at ? 'is-now' : ''}"${i === at ? ' aria-current="step"' : ''}>${v}</li>`).join('')}</ol>`;
};
const card = (o) => `<li>
  <div class="corder__head"><div><h3>${o.items.map((i) => i.qty + ' × ' + esc(i.name)).join(', ')}</h3><small>From ${esc(ownerName(o.sellerId))} · sent ${date(o.createdAt)}</small></div><strong class="corder__total">${peso(o.total)}</strong></div>
  <div class="corder__tags"><span class="pill ${tone[o.status]}">${label[o.status]}</span>${o.madeToOrder ? '<span class="pill pill--info">Made-to-order request</span>' : ''}</div>
  ${track(o)}
  <p class="corder__meta">${o.pickupDate ? `<span>${icon('calendar', 14)} Pickup ${day(o.pickupDate)}</span>` : ''}<span>${icon('phone', 14)} Seller contacts you at ${esc(o.contact)}</span></p>
  ${o.notes ? `<p class="corder__note">${esc(o.notes)}</p>` : ''}
</li>`;

function render() {
  const all = ordersOf(user);
  $('nActive').textContent = all.filter(views.active).length;
  $('nReady').textContent = all.filter(views.ready).length;
  $('nMto').textContent = all.filter(views.mto).length;
  $('nDone').textContent = all.filter(views.completed).length;
  const v = $('fView').value, term = $('q').value;
  document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === v)));
  const list = all.filter((o) => (!v || views[v](o)) && matches(term, ownerName(o.sellerId), o.notes, o.items.map((i) => i.name).join(' ')));
  $('orderTools').hidden = !all.length;
  $('list').innerHTML = list.map(card).join('');
  $('empty').hidden = list.length > 0;
  $('empty').innerHTML = all.length
    ? emptyState('search', 'No orders match', 'Try another word or show all orders.')
    : emptyState('inbox', 'No orders yet', 'Open a product in the <a href="index.html#catalog">catalog</a> and send an order or made-to-order request.', 'Kappy peeking.png');
  $('count').textContent = all.length ? `${list.length} of ${all.length}` : '';
}
document.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => { $('fView').value = $('fView').value === b.dataset.filter ? '' : b.dataset.filter; render(); }));
$('q').addEventListener('input', render);
$('fView').addEventListener('change', render);
store.subscribe(render); render();

// Profile
const form = $('profile');
function fill(u) { $('hello').textContent = 'Welcome, ' + u.name; form.name.value = u.name || ''; form.phone.value = u.phone || ''; $('email').value = u.email; }
fill(current() || user);
form.addEventListener('submit', async (e) => {
  e.preventDefault(); clearErrors(form); $('formError').textContent = '';
  const btn = $('saveBtn'); btn.disabled = true;
  try { fill(await updateProfile(user, Object.fromEntries(new FormData(form)))); toast('Profile saved'); }
  catch (err) { err instanceof ValidationError ? showErrors(form, err.fields) : ($('formError').textContent = err.message); }
  btn.disabled = false;
});
