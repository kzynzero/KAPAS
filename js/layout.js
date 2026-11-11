// Page frames shared across the app.
//  - adminShell(): the Artisan/Business (Seller) workspace sidebar (Dashboard, Products, Materials, Orders, Profile).
//  - siteHeader() / siteFooter(): the public storefront header and footer.
// Both redraw when data changes, so pending-order and low-stock badges update live.
import { current, logout, isSeller, isCustomer, roleLabel } from './auth.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { esc, initials, $ } from './ui.js';

const LOGO = (w, h) => `<img src="assets/kapas-logo.svg" width="${w}" height="${h}" alt="">`;

function counts(u) {
  if (!isSeller(u)) return { pending: 0, low: 0 };
  return {
    pending: store.where('orders', (o) => o.sellerId === u.id && o.status === 'pending').length,
    low: store.where('materials', (m) => m.ownerId === u.id && m.quantity <= m.reorderLevel).length,
  };
}
// Customers: orders that are not completed yet.
const activeOrders = (u) => (isCustomer(u) ? store.where('orders', (o) => o.buyerId === u.id && o.status !== 'completed').length : 0);

const signOut = () => { logout(); location.replace('login.html'); };

export async function adminShell(active) {
  await store.ready;
  const side = $('sidebar'), bar = $('mobilebar');
  const link = (href, ico, text, badge = 0, sr = '') =>
    `<li><a href="${href}"${active === href ? ' aria-current="page"' : ''}>${icon(ico)}<span>${text}</span>${badge ? `<span class="badge">${badge}<span class="sr"> ${sr}</span></span>` : ''}</a></li>`;

  const draw = () => {
    const u = current(); if (!u) return;
    const { pending, low } = counts(u);
    const name = u.businessName || u.name;
    side.innerHTML = `
      <button type="button" class="icon-btn sidebar__close" data-close-menu aria-label="Close menu">${icon('close', 18)}</button>
      <a class="brand sidebar__brand" href="index.html" aria-label="KAPAS storefront">${LOGO(64, 94)}<span class="brand__name">KAPAS</span></a>
      <nav class="sidebar__nav" aria-label="Workspace">
        <p class="sidebar__label">Workspace</p>
        <ul>
          ${link('dashboard.html', 'dashboard', 'Dashboard')}
          ${link('products.html', 'package', 'Products')}
          ${link('materials.html', 'layers', 'Materials inventory', low, 'running low')}
          ${link('orders.html', 'clipboard', 'Orders', pending, 'pending')}
          ${link('profile.html', 'user', 'Seller profile')}
        </ul>
      </nav>
      <nav class="sidebar__nav" aria-label="More">
        <p class="sidebar__label">Shop</p>
        <ul>
          ${link('index.html', 'store', 'View storefront')}
          <li><button type="button" data-signout>${icon('logout')}<span>Sign out</span></button></li>
        </ul>
      </nav>
      <div class="sidebar__user"><span class="avatar" aria-hidden="true">${esc(initials(name))}</span><div><strong>${esc(name)}</strong><small>${esc(roleLabel(u.role))}</small></div></div>
      <footer class="sidebar__footer"><p>Support Local Craft.<br>Keep Our Culture Alive.</p></footer>`;
  };

  bar.innerHTML = `<a class="brand" href="index.html">${LOGO(24, 36)}<span class="brand__name">KAPAS</span></a>
    <button type="button" class="icon-btn" id="menuBtn" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>`;
  const btn = $('menuBtn');
  let scrim = null;
  const setOpen = (open) => {
    side.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open && !scrim) { scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.onclick = () => setOpen(false); document.body.append(scrim); }
    if (!open && scrim) { scrim.remove(); scrim = null; }
  };
  btn.onclick = () => setOpen(!side.classList.contains('is-open'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  side.addEventListener('click', (e) => {
    if (e.target.closest('[data-signout]')) signOut();
    if (e.target.closest('[data-close-menu]')) { setOpen(false); btn.focus(); }
  });

  draw(); store.subscribe(draw);
}

export async function siteHeader(active) {
  await store.ready;
  const el = $('site-header');
  el.className = 'site-header';
  const draw = () => {
    const u = current();
    const { pending } = counts(u), active_ = activeOrders(u);
    const a = (href, inner) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${inner}</a>`;
    const badge = (n, sr) => (n ? `<span class="badge">${n}<span class="sr"> ${sr}</span></span>` : '');
    const out = `<button type="button" class="linkbtn" data-signout>${icon('logout', 18)}<span class="label-wide">Sign out</span></button>`;
    el.innerHTML = `<div class="site-header__inner">
      <a class="brand" href="index.html" aria-label="KAPAS home">${LOGO(26, 38)}<span class="brand__name">KAPAS</span></a>
      <nav class="site-nav" aria-label="Main">
        ${a('index.html', icon('store', 18) + '<span class="label-wide">Catalog</span>')}
        ${isSeller(u)
          ? a('dashboard.html', icon('dashboard', 18) + '<span>Seller dashboard</span>' + badge(pending, 'pending')) + out
          : isCustomer(u)
          ? a('customer.html', icon('clipboard', 18) + '<span>My orders</span>' + badge(active_, 'active')) + out
          : a('login.html', icon('login', 18) + '<span>Sign in</span>') +
            `<a class="btn btn--gold btn--sm label-wide" href="login.html#create">Start selling</a>`}
      </nav></div>`;
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-signout]')) signOut(); });
  draw(); store.subscribe(draw);
}

export function siteFooter() {
  const el = $('site-footer');
  el.className = 'site-footer';
  el.innerHTML = `<div class="site-footer__inner">
    <a class="brand" href="index.html">${LOGO(26, 38)}<span class="brand__name">KAPAS</span></a>
    <p class="tagline">Support Local Craft. Keep Our Culture Alive.</p>
    <p>Moriones-inspired crafts from Marinduque artisans. Payment and pickup are arranged with each seller.</p>
  </div>`;
}
