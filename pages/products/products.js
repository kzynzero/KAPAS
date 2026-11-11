import { store } from '../../js/store.js';
import { guard } from '../../js/auth.js';
import { adminShell } from '../../js/layout.js';
import { esc, peso, toast, compressImage, clearErrors, showErrors, $, wireDialog, confirmDialog, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { saveProduct, deleteProduct, FormError, imagesOf, MAX_PHOTOS } from '../../js/shop.js';
import { matches, sortBy, categoriesOf } from '../../js/filters.js';
 
const user = await guard(['seller']);
await adminShell('products.html');
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, el.dataset.icon === 'image' ? 28 : 18); });
$('addBtn').insertAdjacentHTML('afterbegin', icon('plus', 18));
 
const form = $('pform'); let editing = null, images = [];
const dlg = wireDialog($('productDlg'), () => reset());
function setPhotos(list) {
  images = [...list];
  const grid = $('photoGrid');
  grid.hidden = !images.length; $('photoHint').hidden = images.length < 2;
  $('dropzone').hidden = images.length >= MAX_PHOTOS;
  grid.innerHTML = images.map((src, i) => `<li class="photo-thumb" draggable="true" data-i="${i}">
    <img src="${esc(src)}" alt="Photo ${i + 1} of ${images.length}" draggable="false">
    ${i === 0 ? '<span class="photo-thumb__badge">Cover</span>' : `<button type="button" class="photo-thumb__cover" data-cover="${i}" aria-label="Make photo ${i + 1} the cover">Make cover</button>`}
    <button type="button" class="photo-thumb__remove" data-remove="${i}" aria-label="Remove photo ${i + 1}">${icon('close', 14)}</button></li>`).join('');
}
const cover = (p) => imagesOf(p)[0] || '';
function reset() {
  form.reset(); editing = null; setPhotos([]); $('formError').textContent = '';
  $('formTitle').textContent = 'Add New Product'; $('saveBtn').textContent = 'Save product'; clearErrors(form);
}
function openNew() { reset(); dlg.open(); form.name.focus(); }
function openEdit(p) {
  reset(); editing = p.id;
  for (const k of ['name', 'description', 'category', 'price', 'quantity']) form[k].value = p[k];
  form.published.checked = p.published; setPhotos(imagesOf(p));
  $('formTitle').textContent = 'Edit product'; $('saveBtn').textContent = 'Save changes';
  dlg.open(); form.name.focus();
}
 
const row = (p) => `<tr>
  <td class="cell-primary" data-label="Product"><span class="cell-main">${cover(p) ? `<img class="thumb" src="${esc(cover(p))}" alt="">` : `<span class="thumb thumb--empty">${icon('image', 18)}</span>`}<span><strong>${esc(p.name)}</strong><small>${p.description ? esc(p.description.slice(0, 60)) + (p.description.length > 60 ? '…' : '') : 'No description'}</small></span></span></td>
  <td data-label="Category">${p.category ? esc(p.category) : '<span class="hint">—</span>'}</td>
  <td data-label="Price" class="num"><strong>${peso(p.price)}</strong></td>
  <td data-label="Qty" class="num">${p.quantity}</td>
  <td data-label="Status"><span class="pill ${p.quantity > 0 ? 'pill--ok' : 'pill--warn'}">${p.quantity > 0 ? 'In stock' : 'Made to order'}</span></td>
  <td data-label="In catalog"><label class="switch"><input type="checkbox" data-pub="${p.id}"${p.published ? ' checked' : ''} aria-label="Show ${esc(p.name)} in the public catalog"><span class="switch__track"></span><span class="hint">${p.published ? 'Shown' : 'Hidden'}</span></label></td>
  <td data-label="Actions"><div class="actions">
    <a class="icon-btn" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="View ${esc(p.name)}" title="View">${icon('eye', 18)}</a>
    <button class="icon-btn" data-edit="${p.id}" type="button" aria-label="Edit ${esc(p.name)}" title="Edit">${icon('edit', 18)}</button>
    <button class="icon-btn icon-btn--danger" data-del="${p.id}" type="button" aria-label="Delete ${esc(p.name)}" title="Delete">${icon('trash', 18)}</button>
  </div></td></tr>`;
 
function render() {
  const mine = store.where('products', (p) => p.ownerId === user.id);
  const cats = categoriesOf(mine), keep = $('fCat').value;
  $('fCat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  $('fCat').value = cats.includes(keep) ? keep : '';
  const cat = $('fCat').value, vis = $('fVis').value, term = $('q').value;
  const list = sortBy(mine.filter((p) => (!cat || (p.category || '').trim() === cat) &&
    (!vis || (vis === 'shown' ? p.published : vis === 'hidden' ? !p.published : p.quantity === 0)) &&
    matches(term, p.name, p.description, p.category)), $('sort').value);
  $('list').innerHTML = list.map(row).join('');
  $('empty').hidden = list.length > 0;
  $('empty').innerHTML = mine.length
    ? emptyState('search', 'No products match', 'Try another search word or clear the filters.')
    : emptyState('package', 'You have no products yet', 'Add your first product and it can appear in the public catalog right away.');
  $('count').textContent = mine.length ? `Showing ${list.length} of ${mine.length} product${mine.length === 1 ? '' : 's'}` : '';
  $('cats').innerHTML = categoriesOf(store.list('products')).map((c) => `<option value="${esc(c)}">`).join('');
}
 
// Photos: pick or drop several at once; the first one is the cover
async function takePhotos(files) {
  const list = [...files]; if (!list.length) return;
  $('err-image').textContent = '';
  const room = MAX_PHOTOS - images.length, next = [...images]; let err = '';
  for (const f of list.slice(0, Math.max(0, room))) {
    try { next.push(await compressImage(f)); } catch (e) { err = e.message; }
  }
  if (list.length > room) err = `You can add up to ${MAX_PHOTOS} photos. The extra ones were skipped.`;
  setPhotos(next); $('err-image').textContent = err; $('photo').value = '';
}
$('photo').addEventListener('change', (e) => takePhotos(e.target.files));
const dz = $('dropzone');
dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('is-over'); takePhotos(e.dataTransfer.files); });
 
const grid = $('photoGrid'); let dragFrom = null;
const move = (from, to) => { const next = [...images]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setPhotos(next); };
grid.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]'), mk = e.target.closest('[data-cover]');
  if (rm) { setPhotos(images.filter((_, i) => i !== Number(rm.dataset.remove))); $('err-image').textContent = ''; }
  if (mk) move(Number(mk.dataset.cover), 0);
});
grid.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.photo-thumb'); if (!li) return;
  dragFrom = Number(li.dataset.i); li.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom));
});
grid.addEventListener('dragover', (e) => { if (dragFrom !== null) e.preventDefault(); });
grid.addEventListener('drop', (e) => {
  if (dragFrom === null) return; e.preventDefault();
  const li = e.target.closest('.photo-thumb'), from = dragFrom; dragFrom = null;
  if (li && Number(li.dataset.i) !== from) move(from, Number(li.dataset.i)); else setPhotos(images);
});
grid.addEventListener('dragend', () => { dragFrom = null; grid.querySelectorAll('.is-dragging').forEach((el) => el.classList.remove('is-dragging')); });
 
$('addBtn').onclick = openNew;
if (location.hash === '#new') { history.replaceState(null, '', location.pathname); openNew(); }
['q', 'fCat', 'fVis', 'sort'].forEach((id) => $(id).addEventListener(id === 'q' ? 'input' : 'change', render));
 
$('list').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (edit) { const p = store.find('products', edit.dataset.edit); if (p) openEdit(p); }
  if (del) {
    const p = store.find('products', del.dataset.del); if (!p) return;
    const ok = await confirmDialog('Orders already placed keep their details.', { title: `Delete “${p.name}”?`, confirmLabel: 'Delete product', danger: true });
    if (!ok) return;
    try { await deleteProduct(user, p.id); toast('Product deleted'); } catch (err) { toast(err.message, 'err'); }
  }
});
$('list').addEventListener('change', async (e) => {
  const sw = e.target.closest('[data-pub]'); if (!sw) return;
  const p = store.find('products', sw.dataset.pub); if (!p) return;
  try { await saveProduct(user, { ...p, published: sw.checked }, p.id); toast(sw.checked ? 'Now shown in the catalog' : 'Hidden from the catalog'); }
  catch (err) { toast(err.message, 'err'); render(); }
});
 
form.addEventListener('submit', async (e) => {
  e.preventDefault(); clearErrors(form); $('formError').textContent = '';
  const fd = new FormData(form), btn = $('saveBtn'); btn.disabled = true;
  try {
    await saveProduct(user, { ...Object.fromEntries(fd), images, published: fd.has('published') }, editing);
    toast(editing ? 'Changes saved' : 'Product added'); dlg.close();
  } catch (err) { err instanceof FormError ? showErrors(form, err.fields) : ($('formError').textContent = err.message); }
  btn.disabled = false;
});
store.subscribe(render); render();