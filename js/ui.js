// Small shared UI helpers used by every page: escaping, money, toasts, dialogs, form errors, photos.
import { icon } from './icons.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
export const $ = (id) => document.getElementById(id);
export const date = (t) => new Date(t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
export const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function toast(msg, kind = 'ok') {
  let box = $('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  const t = document.createElement('p');
  t.className = 'toast ' + kind;
  t.innerHTML = icon(kind === 'err' ? 'alert' : 'checkCircle', 18) + '<span></span>';
  t.querySelector('span').textContent = msg;
  box.append(t);
  setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 300); }, 4200);
}

export function clearErrors(form) {
  form.querySelectorAll('.error').forEach((p) => (p.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
}
// Clears a field's error as soon as the user edits it again.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches?.('[aria-invalid="true"]')) return;
  el.removeAttribute('aria-invalid');
  const p = el.name && document.getElementById('err-' + el.name); if (p) p.textContent = '';
});
export function showErrors(form, fields) {
  for (const [name, msg] of Object.entries(fields)) {
    const p = $('err-' + name); if (p) p.textContent = msg;
    const input = form.elements[name]; if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
  }
  form.querySelector('[aria-invalid=true]')?.focus();
}

// Opens a <dialog class="modal">. Clicking the dark backdrop or a [data-close] button closes it.
export function wireDialog(dlg, onClose) {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
  });
  if (onClose) dlg.addEventListener('close', onClose);
  return { open: () => dlg.showModal(), close: () => dlg.close() };
}

// A styled replacement for window.confirm(). Resolves true when the user confirms.
export function confirmDialog(message, { title = 'Are you sure?', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal modal--sm';
    dlg.innerHTML = `<div class="modal__head"><div><h2></h2><p></p></div><button type="button" class="icon-btn" data-no aria-label="Close">${icon('close', 18)}</button></div>
      <div class="modal__foot"><button type="button" class="btn btn--ghost" data-no>Cancel</button><button type="button" class="btn ${danger ? 'btn--crimson' : 'btn--gold'}" data-yes></button></div>`;
    dlg.querySelector('h2').textContent = title;
    dlg.querySelector('p').textContent = message;
    dlg.querySelector('[data-yes]').textContent = confirmLabel;
    let answer = false;
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) { answer = true; dlg.close(); }
      else if (e.target === dlg || e.target.closest('[data-no]')) dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector('[data-yes]').focus();
  });
}

// Photos are shrunk in the browser (longest side 800px, JPEG) so many fit in local storage.
export async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('That photo is over 10 MB. Choose a smaller one.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export const emptyState = (iconName, title, body) =>
  `<div class="empty__icon">${icon(iconName, 26)}</div><h3>${esc(title)}</h3><p>${body}</p>`;
