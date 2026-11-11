// Product detail and the order-request form. Anyone can view; only Customer (Buyer) accounts can order.
import { store } from '../../js/store.js';
import { current, authReady, isSeller, isCustomer } from '../../js/auth.js';
import { siteHeader, siteFooter } from '../../js/layout.js';
import { esc, peso, toast, clearErrors, showErrors, $, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { ownerName, placeOrder, FormError, imagesOf } from '../../js/shop.js';
 
await siteHeader('index.html');
siteFooter();
$('back').insertAdjacentHTML('afterbegin', icon('arrowLeft', 18));
$('payNote').insertAdjacentHTML('afterbegin', icon('info', 18));
$('ownNote').insertAdjacentHTML('afterbegin', icon('info', 18));
$('guestNote').insertAdjacentHTML('afterbegin', icon('user', 18));
$('sellerNote').insertAdjacentHTML('afterbegin', icon('info', 18));
$('sendBtn').insertAdjacentHTML('afterbegin', icon('send', 18));
 
const id = new URLSearchParams(location.search).get('id');
await authReady();
const form = $('oform'), me = current();
form.pickupDate.min = new Date().toISOString().slice(0, 10);
if (isCustomer(me)) { form.customerName.value = me.name; form.contact.value = me.phone || me.email; }
// After signing in, come back to this product.
const back = encodeURIComponent('product.html?id=' + (new URLSearchParams(location.search).get('id') || ''));
$('guestSignIn').href = 'login.html?next=' + back; $('guestCreate').href = 'login.html?next=' + back + '#create-customer';
 
let shown = 0, shownId = null; // which photo is on show
function renderMedia(p) {
  const imgs = imagesOf(p);
  if (shownId !== p.id || shown >= imgs.length) shown = 0;
  shownId = p.id;
  $('media').classList.toggle('detail__media--gallery', imgs.length > 1);
  if (!imgs.length) { $('media').innerHTML = `<div class="detail__noimg">${icon('image', 40)}<span>No photo yet</span></div>`; return; }
  $('media').innerHTML = `<div class="gallery__main"><img src="${esc(imgs[shown])}" alt="${esc(p.name)}${imgs.length > 1 ? ` (photo ${shown + 1} of ${imgs.length})` : ''}"></div>` +
    (imgs.length > 1 ? `<ul class="gallery__thumbs" aria-label="Product photos">${imgs.map((src, i) =>
      `<li><button type="button" class="gallery__thumb" data-g="${i}" aria-label="Show photo ${i + 1} of ${imgs.length}" aria-current="${i === shown}"><img src="${esc(src)}" alt=""></button></li>`).join('')}</ul>` : '');
}
$('media').addEventListener('click', (e) => {
  const b = e.target.closest('[data-g]'); if (!b) return;
  const p = store.find('products', id); if (!p) return;
  shown = Number(b.dataset.g); renderMedia(p);
});
 
function updateTotal() {
  const p = store.find('products', id);
  const q = Number(form.quantity.value);
  $('total').textContent = p && Number.isInteger(q) && q > 0 ? peso(q * p.price) : '—';
}
 
function render() {
  const p = store.find('products', id);
  const ok = p && (p.published || (me && me.id === p.ownerId));
  const own = !!(ok && me && me.id === p.ownerId);
  $('detail').hidden = !ok;
  $('notFound').hidden = !!ok;
  if (!ok) {
    $('notFound').className = 'empty';
    $('notFound').innerHTML = emptyState('package', 'Product not found', 'It may have been removed or hidden by the seller. <a href="index.html">Back to the catalog</a>');
    document.title = 'Product not found · KAPAS';
    return;
  }
  document.title = p.name + ' · KAPAS';
  $('orderBox').hidden = !p.published && !own;
  $('ownNote').hidden = !own;
  $('sellerNote').hidden = own || !isSeller(me);
  $('guestNote').hidden = !!me;
  form.hidden = !isCustomer(me);
  const mto = p.quantity === 0;
  $('orderTitle').textContent = mto ? 'Send a made-to-order request' : 'Send an order request';
  $('orderLead').textContent = mto
    ? 'This piece is made to order. Describe what you want in the notes and the seller will confirm the timeline.'
    : 'The seller will contact you to confirm. If you ask for more than is in stock, it becomes a made-to-order request.';
 
  renderMedia(p);
 
  $('info').innerHTML = `
    <div class="detail__tags">${p.category ? `<span class="pill pill--plain pill--navy">${esc(p.category)}</span>` : ''}
      ${p.published ? '' : '<span class="pill pill--danger">Hidden from the catalog</span>'}</div>
    <h1>${esc(p.name)}</h1>
    <p class="detail__maker">${icon('user', 16)} Made by <strong>${esc(ownerName(p.ownerId))}</strong></p>
    <p class="detail__price">${peso(p.price)}</p>
    <p class="pill ${p.quantity > 0 ? 'pill--ok' : 'pill--warn'}">${p.quantity > 0 ? p.quantity + ' available now' : 'Made to order. The seller will confirm the timeline.'}</p>
    <div class="detail__desc">${p.description ? esc(p.description) : '<span class="hint">No description yet.</span>'}</div>`;
  updateTotal();
}
 
form.addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]'); if (!b) return;
  const q = Math.min(999, Math.max(1, (parseInt(form.quantity.value, 10) || 0) + Number(b.dataset.step)));
  form.quantity.value = q; updateTotal();
});
form.quantity.addEventListener('input', updateTotal);
 
store.subscribe(render); render();
 
form.addEventListener('submit', async (e) => {
  e.preventDefault(); clearErrors(form); $('formError').textContent = ''; $('done').textContent = '';
  const btn = $('sendBtn'); btn.disabled = true;
  try {
    const o = await placeOrder(me, { ...Object.fromEntries(new FormData(form)), productId: id });
    $('done').innerHTML = `<img class="order-success__mascot" src="assets/Kappy happy.png" alt="" aria-hidden="true"><span>${esc((o.madeToOrder ? 'Made-to-order request' : 'Order request') + ' sent to ' + ownerName(o.sellerId) + '. They will contact you at ' + o.contact + '. ')}<a href="customer.html">Track it in My orders</a></span>`;
    form.quantity.value = 1; form.notes.value = ''; form.pickupDate.value = ''; updateTotal();
    toast('Order request sent');
  } catch (err) { err instanceof FormError ? showErrors(form, err.fields) : ($('formError').textContent = err.message); }
  btn.disabled = false;
});