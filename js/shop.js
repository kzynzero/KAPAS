// Business rules for products and orders. Pages call these; nothing here touches the DOM.
import { store, MAX_PHOTOS } from './store.js';
import { normalizeRole } from './auth.js';
export { MAX_PHOTOS };

// Role checks. The account is read back from storage, so a page cannot pass in a different role.
const roleOf = (user) => { const u = user && store.find('users', user.id); return u ? normalizeRole(u.role) : null; };
function requireSeller(user, action) {
  if (roleOf(user) !== 'seller') throw new Error('Only Artisan/Business (Seller) accounts can ' + action + '.');
}
 
export const STATUSES = [['pending', 'Pending'], ['in_production', 'In production'], ['ready', 'Ready for pickup'], ['completed', 'Completed']];
export class FormError extends Error {
  constructor(fields) { super('Check the highlighted fields.'); this.fields = fields; }
}
const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,/;
// A product's photos, cover first. Older products only have a single `image`, so this covers both.
export const imagesOf = (p) => (Array.isArray(p.images) ? p.images : p.image ? [p.image] : []);
const int = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
 
export function ownerName(id) {
  const u = store.find('users', id);
  return u ? u.businessName || u.name : 'Unknown seller';
}
 
export function checkProduct(f) {
  const e = {};
  if ((f.name || '').trim().length < 2 || f.name.trim().length > 80) e.name = 'Enter a name of 2 to 80 characters.';
  if ((f.description || '').length > 500) e.description = 'Keep the description under 500 characters.';
  if ((f.category || '').trim().length > 30) e.category = 'Keep the category under 30 characters.';
  const price = Number(f.price);
  if (f.price === '' || f.price == null || !Number.isFinite(price) || price <= 0 || price > 1000000) e.price = 'Enter a price greater than zero.';
  if (Number.isNaN(int(f.quantity ?? ''))) e.quantity = 'Enter a whole number, 0 or more.';
  const imgs = imagesOf(f);
  if (imgs.length > MAX_PHOTOS) e.image = 'Add up to ' + MAX_PHOTOS + ' photos.';
  else if (imgs.some((s) => !DATA_IMAGE.test(s))) e.image = 'Choose JPG, PNG or WebP photos.';
  return e;
}
 
export async function saveProduct(user, f, id = null) {
  requireSeller(user, 'add or edit products');
  const errors = checkProduct(f);
  if (Object.keys(errors).length) throw new FormError(errors);
  const images = imagesOf(f); // `image` stays as the cover so the catalog and older code keep working
  const row = { name: f.name.trim(), description: (f.description || '').trim(), category: (f.category || '').trim(),
    price: Number(f.price), quantity: int(f.quantity), images, image: images[0] || '', published: !!f.published };
  if (!id) return store.add('products', { ...row, ownerId: user.id });
  const p = store.find('products', id);
  if (!p || p.ownerId !== user.id) throw new Error('You can only edit your own products.');
  return store.update('products', id, row);
}
 
export async function deleteProduct(user, id) {
  requireSeller(user, 'delete products');
  const p = store.find('products', id);
  if (!p || p.ownerId !== user.id) throw new Error('You can only delete your own products.');
  return store.remove('products', id);
}
 
// An order request from a signed-in Customer (Buyer). When the seller does not have enough pieces
// in stock (quantity 0 means made to order), the request is marked as a made-to-order request.
export async function placeOrder(buyer, f) {
  const p = store.find('products', f.productId);
  if (!p || !p.published) throw new Error('This product is no longer available.');
  if (buyer && buyer.id === p.ownerId) throw new Error('This is your own product.');
  const role = roleOf(buyer);
  if (!role) throw new Error('Sign in with a Customer account to send an order request.');
  if (role !== 'customer') throw new Error('Seller accounts cannot place orders. Sign in with a Customer account to order.');
  const e = {}, qty = int(f.quantity ?? '');
  if (!(qty >= 1 && qty <= 999)) e.quantity = 'Enter a quantity from 1 to 999.';
  if ((f.customerName || '').trim().length < 2) e.customerName = 'Enter your name.';
  if ((f.contact || '').trim().length < 7) e.contact = 'Enter a mobile number or email so the seller can reach you.';
  if (f.pickupDate && !(f.pickupDate >= new Date().toISOString().slice(0, 10))) e.pickupDate = 'Choose today or a later date.';
  if ((f.notes || '').length > 300) e.notes = 'Keep notes under 300 characters.';
  if (Object.keys(e).length) throw new FormError(e);
  return store.add('orders', {
    sellerId: p.ownerId, buyerId: buyer.id, source: 'customer', madeToOrder: qty > p.quantity,
    customerName: f.customerName.trim(), contact: f.contact.trim(), notes: (f.notes || '').trim(), pickupDate: f.pickupDate || '',
    status: 'pending', items: [{ productId: p.id, name: p.name, qty, price: p.price }], total: qty * p.price, stockDeducted: false,
  });
}
 
// Completing an order takes its items out of stock; moving it back puts them back.
export async function setOrderStatus(user, id, status) {
  requireSeller(user, 'update order statuses');
  const o = store.find('orders', id);
  if (!o || o.sellerId !== user.id) throw new Error('You can only update your own orders.');
  if (!STATUSES.some(([k]) => k === status)) throw new Error('Unknown status.');
  const patch = { status };
  const shift = status === 'completed' && !o.stockDeducted ? -1 : status !== 'completed' && o.stockDeducted ? 1 : 0;
  if (shift) {
    for (const it of o.items) {
      const p = store.find('products', it.productId);
      if (p) await store.update('products', p.id, { quantity: Math.max(0, p.quantity + shift * it.qty) });
    }
    patch.stockDeducted = shift < 0;
  }
  return store.update('orders', id, patch);
}
 
// ---- Materials (Feature 2) ----
const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN);
const r2 = (n) => Math.round(n * 100) / 100;
export const materialState = (m) => (m.quantity <= 0 ? 'out' : m.quantity <= m.reorderLevel ? 'low' : 'ok');
 
export function checkMaterial(f) {
  const e = {};
  const name = (f.name || '').trim(), unit = (f.unit || '').trim();
  if (name.length < 2 || name.length > 60) e.name = 'Enter a name of 2 to 60 characters.';
  if (unit.length < 1 || unit.length > 12) e.unit = 'Enter a unit such as kg, pcs or liters.';
  const q = num(f.quantity), lv = num(f.reorderLevel);
  if (!(q >= 0 && q <= 1000000)) e.quantity = 'Enter an amount, 0 or more.';
  if (!(lv >= 0 && lv <= 1000000)) e.reorderLevel = 'Enter a level, 0 or more.';
  return e;
}
const ownMaterial = (user, id) => {
  requireSeller(user, 'manage materials');
  const m = store.find('materials', id);
  if (!m || m.ownerId !== user.id) throw new Error('You can only change your own materials.');
  return m;
};
export async function saveMaterial(user, f, id = null) {
  requireSeller(user, 'manage materials');
  const errors = checkMaterial(f);
  if (Object.keys(errors).length) throw new FormError(errors);
  const row = { name: f.name.trim(), unit: f.unit.trim(), quantity: r2(Number(f.quantity)), reorderLevel: r2(Number(f.reorderLevel)) };
  if (!id) return store.add('materials', { ...row, ownerId: user.id });
  ownMaterial(user, id);
  return store.update('materials', id, row);
}
export async function deleteMaterial(user, id) { ownMaterial(user, id); return store.remove('materials', id); }
 
// direction is 'add' (stock received) or 'use' (stock used up).
export async function adjustMaterial(user, id, amount, direction) {
  const m = ownMaterial(user, id), a = num(amount);
  if (!(a > 0 && a <= 1000000)) throw new FormError({ ['amount-' + id]: 'Enter an amount greater than zero.' });
  if (!['add', 'use'].includes(direction)) throw new Error('Unknown action.');
  const next = r2(m.quantity + (direction === 'add' ? a : -a));
  if (next < 0) throw new Error('Only ' + m.quantity + ' ' + m.unit + ' of ' + m.name + ' left. You cannot use more than that.');
  return store.update('materials', id, { quantity: next });
}
 
// Finished pieces go into a product's stock (and show in the catalog); optionally take material out.
export async function recordProduction(user, f) {
  requireSeller(user, 'record finished pieces');
  const p = store.find('products', f.productId), e = {};
  if (!p || p.ownerId !== user.id) e.productId = 'Choose one of your products.';
  const made = /^\d+$/.test(String(f.made ?? '').trim()) ? Number(f.made) : NaN;
  if (!(made >= 1 && made <= 99999)) e.made = 'Enter how many pieces you finished.';
  const used = f.materialId ? num(f.used) : 0;
  if (f.materialId && !(used > 0)) e.used = 'Enter how much material you used.';
  if (Object.keys(e).length) throw new FormError(e);
  if (f.materialId) {
    const m = ownMaterial(user, f.materialId);
    if (used > m.quantity) throw new FormError({ used: 'Only ' + m.quantity + ' ' + m.unit + ' of ' + m.name + ' left.' });
    await store.update('materials', m.id, { quantity: r2(m.quantity - used) });
  }
  return store.update('products', p.id, { quantity: p.quantity + made });
}
// ---- Customer side ----
// A made-to-order request: the order was flagged when placed, or the product had no stock (older orders).
export const isMadeToOrder = (o) => o.madeToOrder === true;
// The customer's own orders, newest first. Only the buyer who placed them can see them here.
export function ordersOf(customer) {
  if (roleOf(customer) !== 'customer') return [];
  return store.where('orders', (o) => o.buyerId === customer.id).sort((a, b) => b.createdAt - a.createdAt);
}
