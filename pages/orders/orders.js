// Orders board: requests grouped by status. Changing the status runs setOrderStatus,
// which also moves stock when an order is completed or re-opened.
import { store } from '../../js/store.js';
import { guard } from '../../js/auth.js';
import { adminShell } from '../../js/layout.js';
import { esc, peso, toast, $, date, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { STATUSES, setOrderStatus, ownerName } from '../../js/shop.js';
import { matches } from '../../js/filters.js';

const user = await guard(['artisan', 'business']);
await adminShell('orders.html');
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, 18); });

const label = Object.fromEntries(STATUSES);
const tone = { pending: 'pill--gold', in_production: 'pill--info', ready: 'pill--warn', completed: 'pill--ok' };
const colIcon = { pending: 'inbox', in_production: 'hammer', ready: 'box', completed: 'checkCircle' };
const day = (d) => date(d + 'T00:00');

const card = (o) => `<article class="ocard">
  <header class="ocard__head"><div><h3>${esc(o.customerName)}</h3><p class="ocard__contact">${icon('phone', 14)} ${esc(o.contact)}</p></div><strong class="ocard__total">${peso(o.total)}</strong></header>
  <ul class="ocard__items">${o.items.map((i) => `<li><span>${i.qty} × ${esc(i.name)}</span><span>${peso(i.qty * i.price)}</span></li>`).join('')}</ul>
  <p class="ocard__meta">${icon('clock', 14)} Requested ${date(o.createdAt)}</p>
  ${o.pickupDate ? `<p class="ocard__meta">${icon('calendar', 14)} Pickup ${day(o.pickupDate)}</p>` : ''}
  ${o.source === 'business' ? `<p class="ocard__meta">${icon('store', 14)} From a Business account</p>` : ''}
  ${o.notes ? `<p class="ocard__note">${esc(o.notes)}</p>` : ''}
  <div class="field ocard__status"><label for="s-${o.id}">Status</label><select id="s-${o.id}" data-id="${o.id}">${STATUSES.map(([k, v]) => `<option value="${k}"${k === o.status ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
</article>`;

const sorters = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  pickup: (a, b) => (a.pickupDate || '9999').localeCompare(b.pickupDate || '9999') || b.createdAt - a.createdAt,
};

function render() {
  const all = store.where('orders', (o) => o.sellerId === user.id);
  const term = $('q').value;
  const mine = all.filter((o) => matches(term, o.customerName, o.contact, o.notes, o.items.map((i) => i.name).join(' ')))
    .sort(sorters[$('sort').value] || sorters.newest);
  $('orderTools').hidden = !all.length;
  $('empty').hidden = mine.length > 0; $('board').hidden = !mine.length;
  $('empty').innerHTML = all.length
    ? emptyState('search', 'No orders match', 'Try another name, contact or product.')
    : emptyState('inbox', 'No order requests yet', 'When someone sends one from your product page, it shows up here as Pending.');
  $('count').textContent = all.length ? `${mine.length} of ${all.length} order${all.length === 1 ? '' : 's'}` : '';
  $('board').innerHTML = STATUSES.map(([k, v]) => {
    const col = mine.filter((o) => o.status === k);
    return `<section class="col col--${k}" aria-label="${v}"><h2 class="col__head"><span class="col__icon">${icon(colIcon[k], 16)}</span>${v} <span class="col__count">${col.length}</span></h2>
      <div class="col__body">${col.map(card).join('') || '<p class="col__empty">Nothing here</p>'}</div></section>`;
  }).join('');

  const placed = store.where('orders', (o) => o.buyerId === user.id).sort((a, b) => b.createdAt - a.createdAt);
  $('placed').hidden = !placed.length;
  $('placedList').innerHTML = placed.map((o) => `<tr>
    <td class="cell-primary" data-label="Items"><strong>${o.items.map((i) => i.qty + ' × ' + esc(i.name)).join(', ')}</strong></td>
    <td data-label="Seller">${esc(ownerName(o.sellerId))}</td>
    <td data-label="Total" class="num">${peso(o.total)}</td>
    <td data-label="Sent">${date(o.createdAt)}</td>
    <td data-label="Status"><span class="pill ${tone[o.status]}">${label[o.status]}</span></td></tr>`).join('');
}

$('board').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-id]'); if (!sel) return;
  try { await setOrderStatus(user, sel.dataset.id, sel.value); toast('Order moved to ' + label[sel.value]); }
  catch (err) { toast(err.message, 'err'); render(); }
});
$('q').addEventListener('input', render);
$('sort').addEventListener('change', render);
store.subscribe(render); render();
