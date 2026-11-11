// Public catalog: every published product from every seller, with search, category filter and sort.
import { store } from '../../js/store.js';
import { siteHeader, siteFooter } from '../../js/layout.js';
import { esc, peso, $, emptyState } from '../../js/ui.js';
import { icon } from '../../js/icons.js';
import { ownerName } from '../../js/shop.js';
import { matches, sortBy, categoriesOf } from '../../js/filters.js';

await siteHeader('index.html');
siteFooter();
$('heroArrow').outerHTML = icon('arrowRight', 18);
$('heroSpark').outerHTML = icon('sparkle', 16);
$('searchIcon').outerHTML = icon('search', 20);

const card = (p) => `<li><a class="pcard" href="product.html?id=${encodeURIComponent(p.id)}">
  <div class="pcard__media">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : `<span class="pcard__noimg">${icon('image', 28)}<span>No photo yet</span></span>`}
    ${p.category ? `<span class="pcard__cat">${esc(p.category)}</span>` : ''}</div>
  <div class="pcard__body">
    <h3>${esc(p.name)}</h3>
    <p class="pcard__maker">by ${esc(ownerName(p.ownerId))}</p>
    <div class="pcard__foot"><span class="pcard__price">${peso(p.price)}</span>
      <span class="pill ${p.quantity > 0 ? 'pill--ok' : 'pill--warn'}">${p.quantity > 0 ? p.quantity + ' available' : 'Made to order'}</span></div>
  </div></a></li>`;

function render() {
  const all = store.where('products', (p) => p.published);
  const cats = categoriesOf(all);
  const keep = $('cat').value;
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  $('cat').value = cats.includes(keep) ? keep : '';
  const cat = $('cat').value;
  $('chips').innerHTML = cats.length > 1 ? ['', ...cats].map((c) =>
    `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${c ? esc(c) : 'All'}</button>`).join('') : '';

  const term = $('q').value.trim();
  const list = sortBy(all.filter((p) => (!cat || (p.category || '').trim() === cat) &&
    matches(term, p.name, p.description, p.category, ownerName(p.ownerId))), $('sort').value);

  $('grid').innerHTML = list.map(card).join('');
  $('count').textContent = list.length + (list.length === 1 ? ' product' : ' products') + (term || cat ? ' match' : '');
  $('empty').hidden = list.length > 0;
  $('empty').innerHTML = all.length
    ? emptyState('search', 'Nothing matches yet', 'Try another word or choose a different category.')
    : emptyState('package', 'No products listed yet', 'Artisans and businesses can <a href="login.html#create">create a seller account</a> and add the first one.', 'Kappy peeking.png');

  $('sProducts').textContent = all.length;
  $('sMakers').textContent = new Set(all.map((p) => p.ownerId)).size;
  $('sCats').textContent = cats.length;
}

$('q').addEventListener('input', render);
$('cat').addEventListener('change', render);
$('sort').addEventListener('change', render);
$('chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  $('cat').value = b.dataset.cat; render();
});
store.subscribe(render); render();
