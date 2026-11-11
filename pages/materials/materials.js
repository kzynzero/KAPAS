// Materials inventory: add / edit / delete materials, add or use stock, record finished pieces.
import { store } from '../../js/store.js';
import { guard } from '../../js/auth.js';
import { adminShell } from '../../js/layout.js';
import { esc, toast, clearErrors, showErrors, $, wireDialog, confirmDialog, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { saveMaterial, deleteMaterial, adjustMaterial, recordProduction, materialState, FormError } from '../../js/shop.js';
import { matches, sortBy } from '../../js/filters.js';

const user = await guard(['seller']);
await adminShell('materials.html');
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, ['layers', 'trendDown', 'alert'].includes(el.dataset.icon) ? 22 : 18); });
$('addBtn').insertAdjacentHTML('afterbegin', icon('plus', 18));
$('prodOpen').insertAdjacentHTML('afterbegin', icon('hammer', 18));

const form = $('mform'), pform = $('pform'); let editing = null;
const words = { ok: 'In stock', low: 'Running low', out: 'Out of stock' };
const tone = { ok: 'pill--ok', low: 'pill--warn', out: 'pill--danger' };
const mdlg = wireDialog($('materialDlg'), () => reset());
const pdlg = wireDialog($('prodDlg'), () => { clearErrors(pform); $('prodError').textContent = ''; });
function reset() { form.reset(); editing = null; $('formTitle').textContent = 'Add a material'; $('saveBtn').textContent = 'Save material'; $('formError').textContent = ''; clearErrors(form); }

const row = (m) => { const s = materialState(m); return `<tr class="mrow mrow--${s}">
  <td class="cell-primary" data-label="Material"><span class="cell-main"><span class="thumb thumb--empty mat-icon mat-icon--${s}">${icon('layers', 18)}</span><span><strong>${esc(m.name)}</strong><small>Measured in ${esc(m.unit)}</small></span></span></td>
  <td data-label="On hand" class="num"><strong>${m.quantity}</strong> ${esc(m.unit)}</td>
  <td data-label="Reorder at" class="num">${m.reorderLevel}</td>
  <td data-label="Status"><span class="pill ${tone[s]}">${words[s]}</span></td>
  <td data-label="Adjust stock"><div class="adjust">
    <label class="sr" for="amount-${m.id}">Amount for ${esc(m.name)}</label>
    <input class="control" id="amount-${m.id}" type="number" min="0" step="any" inputmode="decimal" placeholder="Amount" aria-describedby="err-amount-${m.id}">
    <button class="btn btn--sm" data-add="${m.id}" type="button" aria-label="Add stock to ${esc(m.name)}" title="Add stock">${icon('plus', 16)}Add</button>
    <button class="btn btn--ghost btn--sm" data-use="${m.id}" type="button" aria-label="Use stock of ${esc(m.name)}" title="Use stock">Use</button>
    <p class="error" id="err-amount-${m.id}"></p></div></td>
  <td data-label="Actions"><div class="actions">
    <button class="icon-btn" data-edit="${m.id}" type="button" aria-label="Edit ${esc(m.name)}" title="Edit">${icon('edit', 18)}</button>
    <button class="icon-btn icon-btn--danger" data-del="${m.id}" type="button" aria-label="Delete ${esc(m.name)}" title="Delete">${icon('trash', 18)}</button>
  </div></td></tr>`; };

function render() {
  const mats = store.where('materials', (m) => m.ownerId === user.id);
  $('nAll').textContent = mats.length;
  $('nLow').textContent = mats.filter((m) => materialState(m) === 'low').length;
  $('nOut').textContent = mats.filter((m) => materialState(m) === 'out').length;
  const st = $('fState').value;
  document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === st)));
  const sortKey = $('sort').value;
  const list = sortBy(mats.filter((m) => (!st || materialState(m) === st) && matches($('q').value, m.name, m.unit)), sortKey);
  $('list').innerHTML = list.map(row).join('');
  $('empty').hidden = list.length > 0;
  $('empty').innerHTML = mats.length
    ? emptyState('search', 'No materials match', 'Try another search word or stock level.')
    : emptyState('layers', 'No materials yet', 'Add the wood, paint and other supplies you work with, and set a reorder level for each.', 'Kappy peeking.png');

  const prods = store.where('products', (p) => p.ownerId === user.id);
  const keepP = $('productId').value, keepM = $('materialId').value;
  const byName = mats.slice().sort((a, b) => a.name.localeCompare(b.name));
  $('productId').innerHTML = prods.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.quantity} in stock)</option>`).join('');
  $('materialId').innerHTML = '<option value="">None</option>' + byName.map((m) => `<option value="${m.id}">${esc(m.name)} (${m.quantity} ${esc(m.unit)})</option>`).join('');
  if (prods.some((p) => p.id === keepP)) $('productId').value = keepP;
  if (mats.some((m) => m.id === keepM)) $('materialId').value = keepM;
  $('noProducts').hidden = prods.length > 0; $('prodBtn').disabled = !prods.length;
}

$('addBtn').onclick = () => { reset(); mdlg.open(); form.name.focus(); };
$('prodOpen').onclick = () => { pdlg.open(); (pform.productId.options.length ? pform.made : pform.productId).focus(); };
document.querySelector('.mat-summary').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  $('fState').value = $('fState').value === b.dataset.filter ? '' : b.dataset.filter; render();
});
['q', 'fState', 'sort'].forEach((id) => $(id).addEventListener(id === 'q' ? 'input' : 'change', render));

$('list').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]'), add = e.target.closest('[data-add]'), use = e.target.closest('[data-use]');
  try {
    if (edit) {
      const m = store.find('materials', edit.dataset.edit); if (!m) return;
      reset(); editing = m.id; for (const k of ['name', 'unit', 'quantity', 'reorderLevel']) form[k].value = m[k];
      $('formTitle').textContent = 'Edit material'; $('saveBtn').textContent = 'Save changes'; mdlg.open(); form.name.focus();
    } else if (del) {
      const m = store.find('materials', del.dataset.del); if (!m) return;
      if (await confirmDialog('This removes it from your inventory.', { title: `Delete “${m.name}”?`, confirmLabel: 'Delete material', danger: true })) {
        await deleteMaterial(user, m.id); toast('Material deleted');
      }
    } else if (add || use) {
      const id = (add || use).dataset.add || (add || use).dataset.use, box = $('amount-' + id); $('err-amount-' + id).textContent = '';
      try { await adjustMaterial(user, id, box.value, add ? 'add' : 'use'); toast(add ? 'Stock added' : 'Stock updated'); }
      catch (err) { if (err instanceof FormError) { $('err-amount-' + id).textContent = err.fields['amount-' + id]; box.focus(); } else throw err; }
    }
  } catch (err) { toast(err.message, 'err'); }
});
$('list').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.id?.startsWith('amount-')) return;
  e.preventDefault(); e.target.closest('.adjust').querySelector('[data-add]').click();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault(); clearErrors(form); $('formError').textContent = ''; $('saveBtn').disabled = true;
  try { await saveMaterial(user, Object.fromEntries(new FormData(form)), editing); toast(editing ? 'Changes saved' : 'Material added'); mdlg.close(); }
  catch (err) { err instanceof FormError ? showErrors(form, err.fields) : ($('formError').textContent = err.message); }
  $('saveBtn').disabled = false;
});
pform.addEventListener('submit', async (e) => {
  e.preventDefault(); clearErrors(pform); $('prodError').textContent = ''; $('prodBtn').disabled = true;
  try { await recordProduction(user, Object.fromEntries(new FormData(pform))); toast('Pieces added to stock'); pform.made.value = ''; pform.used.value = ''; pdlg.close(); }
  catch (err) { err instanceof FormError ? showErrors(pform, err.fields) : ($('prodError').textContent = err.message); }
  $('prodBtn').disabled = false;
});
store.subscribe(render); render();
