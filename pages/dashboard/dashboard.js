// Seller Dashboard, shared by every Artisan/Business (Seller) account: live counts, recent requests, low materials, and backup / restore.
import { store } from '../../js/store.js';
import { guard, roleLabel } from '../../js/auth.js';
import { adminShell } from '../../js/layout.js';
import { toast, $, esc, peso, date, confirmDialog, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { STATUSES, materialState } from '../../js/shop.js';

const user = await guard(['seller']);
await adminShell('dashboard.html');

document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, 22); });
$('addProduct').insertAdjacentHTML('afterbegin', icon('plus', 18));
$('viewCatalog').insertAdjacentHTML('afterbegin', icon('store', 18));
$('export').insertAdjacentHTML('afterbegin', icon('download', 18));
$('importLabel').insertAdjacentHTML('afterbegin', icon('upload', 18));

$('hello').textContent = 'Welcome, ' + (user.businessName || user.name);
$('role').textContent = roleLabel(user.role) + ' account';
$('roleText').textContent = 'Here is how your products, materials and customer orders are doing today.';

const label = Object.fromEntries(STATUSES);
const tone = { pending: 'pill--gold', in_production: 'pill--info', ready: 'pill--warn', completed: 'pill--ok' };

function render() {
  const ps = store.where('products', (p) => p.ownerId === user.id), os = store.where('orders', (o) => o.sellerId === user.id);
  const mats = store.where('materials', (m) => m.ownerId === user.id);
  $('nProducts').textContent = ps.length; $('nPublished').textContent = ps.filter((p) => p.published).length;
  $('nPending').textContent = os.filter((o) => o.status === 'pending').length;
  $('nMaking').textContent = os.filter((o) => o.status === 'in_production' || o.status === 'ready').length;
  $('nLow').textContent = mats.filter((m) => m.quantity <= m.reorderLevel).length;
  $('nDone').textContent = os.filter((o) => o.status === 'completed').length;

  $('nMto').textContent = os.filter((o) => o.madeToOrder && o.status !== 'completed').length;
  const recent = os.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  $('recent').innerHTML = recent.map((o) => `<li><a class="feed__row" href="orders.html">
      <span class="feed__icon">${icon('clipboard', 18)}</span>
      <span class="feed__main"><strong>${esc(o.customerName)}</strong><small>${o.items.map((i) => i.qty + ' × ' + esc(i.name)).join(', ')} · ${date(o.createdAt)}</small></span>
      <span class="feed__end">${o.madeToOrder ? '<span class="pill pill--info">Made to order</span>' : ''}<b>${peso(o.total)}</b><span class="pill ${tone[o.status]}">${label[o.status]}</span></span></a></li>`).join('');
  $('recentEmpty').hidden = recent.length > 0;
  $('recentEmpty').innerHTML = emptyState('inbox', 'No requests yet', 'When a customer sends a request from your product page, it appears here.');

  const low = mats.filter((m) => m.quantity <= m.reorderLevel).sort((a, b) => a.quantity - b.quantity);
  $('lowList').innerHTML = low.map((m) => { const s = materialState(m); return `<li><a class="feed__row" href="materials.html">
      <span class="feed__icon feed__icon--${s}">${icon('layers', 18)}</span>
      <span class="feed__main"><strong>${esc(m.name)}</strong><small>${m.quantity} ${esc(m.unit)} on hand · reorder at ${m.reorderLevel}</small></span>
      <span class="feed__end"><span class="pill ${s === 'out' ? 'pill--danger' : 'pill--warn'}">${s === 'out' ? 'Out of stock' : 'Running low'}</span></span></a></li>`; }).join('');
  $('lowEmpty').hidden = low.length > 0;
  $('lowEmpty').innerHTML = emptyState('checkCircle', mats.length ? 'All materials are stocked' : 'No materials yet',
    mats.length ? 'Nothing is at or below its reorder level.' : 'Add your supplies under <a href="materials.html">Materials inventory</a>.');
}

$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(store.exportAll())], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'kapas-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
  a.click(); URL.revokeObjectURL(url); toast('Backup downloaded');
};
$('importLabel').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('import').click(); } });
$('import').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 50 * 1024 * 1024) return toast('That file is too large to be a KAPAS backup.', 'err');
  const ok = await confirmDialog('It replaces everything now on this device, and you may need to sign in again.', { title: 'Restore from this backup?', confirmLabel: 'Restore', danger: true });
  if (!ok) return;
  try { await store.importAll(await f.text()); toast('Backup restored'); } catch (err) { toast(err.message, 'err'); }
});
store.subscribe(render); render();
