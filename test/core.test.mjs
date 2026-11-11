import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const { createStore } = await import('../js/store.js');
const { register, login, current, logout, guard, homeFor, roleLabel, updateProfile, authReady, ValidationError } = await import('../js/auth.js');

const good = { role: 'seller', name: 'Maria Santos', email: 'Maria@Example.com', password: 'mask2026x', confirm: 'mask2026x' };

test('store: add, update, remove persist and reload', async () => {
  const a = createStore('t1'); await a.ready;
  const p = await a.add('products', { name: 'Morion mask', price: 850, image: 'data:image/jpeg;base64,AAAA' });
  await a.update('products', p.id, { price: 900 });
  a.close();
  const b = createStore('t1'); await b.ready;
  assert.equal(b.find('products', p.id).price, 900);
  await b.remove('products', p.id);
  assert.equal(b.list('products').length, 0);
  b.close();
});

test('store: a change in one tab reaches another tab (image post updates other pages)', async () => {
  const a = createStore('t2'), b = createStore('t2');
  await Promise.all([a.ready, b.ready]);
  const seen = new Promise((res) => b.subscribe((name) => res(name)));
  const p = await a.add('products', { name: 'Hand-carved mask', image: 'data:image/jpeg;base64,BBBB' });
  assert.equal(await Promise.race([seen, new Promise((r) => setTimeout(() => r('timeout'), 2000))]), 'products');
  assert.equal(b.find('products', p.id).image, 'data:image/jpeg;base64,BBBB');
  a.close(); b.close();
});

test('store: simultaneous writes from two tabs both survive', async () => {
  const a = createStore('t3'), b = createStore('t3');
  await Promise.all([a.ready, b.ready]);
  await Promise.all([a.add('orders', { n: 1 }), b.add('orders', { n: 2 }), a.add('orders', { n: 3 })]);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(a.list('orders').length, 3);
  assert.equal(b.list('orders').length, 3);
  a.close(); b.close();
});

test('auth: register validates, hashes, and starts a session', async () => {
  await assert.rejects(register({ ...good, email: 'bad', password: 'short', confirm: 'x' }),
    (e) => e instanceof ValidationError && !!(e.fields.email && e.fields.password && e.fields.confirm));
  for (const role of ['artisan', 'business', 'admin', '']) // only Seller and Customer can be chosen
    await assert.rejects(register({ role, name: 'Jo Cruz', email: 'j@x.com', password: 'abcdefg1', confirm: 'abcdefg1' }), (e) => !!e.fields.role);
  const user = await register(good);
  assert.equal(user.email, 'maria@example.com');
  assert.equal(user.passwordHash, undefined);
  assert.equal(current().id, user.id);
  const { store } = await import('../js/store.js');
  const stored = store.find('users', user.id);
  assert.ok(stored.passwordHash && stored.passwordHash !== good.password && stored.salt);
});

test('auth: duplicate email, wrong password, logout, correct login, lockout', async () => {
  await assert.rejects(register(good), (e) => !!e.fields.email);
  logout(); assert.equal(current(), null);
  await assert.rejects(login('maria@example.com', 'wrong'), /incorrect/);
  const u = await login(' MARIA@example.com ', 'mask2026x');
  assert.equal(u.role, 'seller');
  logout();
  for (let i = 0; i < 5; i++) await login('maria@example.com', 'nope').catch(() => {});
  await assert.rejects(login('maria@example.com', 'mask2026x'), /Too many/);
});

const { saveProduct, deleteProduct, placeOrder, setOrderStatus, ownerName, FormError,
  saveMaterial, deleteMaterial, adjustMaterial, recordProduction, materialState } = await import('../js/shop.js');
const { store: shared } = await import('../js/store.js');
const img = 'data:image/jpeg;base64,/9j/AAAA';
let artisan, shop, buyer, mask;

test('auth: exactly two account types, Seller and Customer, each with its own dashboard', async () => {
  const c = await register({ role: 'customer', name: 'Rina Lopez', businessName: 'ignored', email: 'rina@x.com', password: 'buy2026abc', confirm: 'buy2026abc' });
  assert.equal(c.role, 'customer'); assert.equal(c.businessName, '');
  assert.equal(homeFor(c), 'customer.html');
  assert.equal(homeFor({ role: 'seller' }), 'dashboard.html');
  assert.equal(roleLabel('seller'), 'Artisan/Business (Seller)'); assert.equal(roleLabel('customer'), 'Customer (Buyer)');
  logout();
});

test('auth: old Artisan and Business accounts become Seller accounts and keep their data', async () => {
  const { store } = await import('../js/store.js');
  const a = await store.add('users', { role: 'artisan', name: 'Old Artisan', email: 'old-a@x.com', businessName: '', salt: 's', passwordHash: 'h' });
  const b = await store.add('users', { role: 'business', name: 'Old Owner', email: 'old-b@x.com', businessName: 'Gasan Crafts', salt: 's', passwordHash: 'h' });
  const { authReady: fresh } = await import('../js/auth.js?again'); // a new page load runs the conversion
  await fresh();
  assert.equal(store.find('users', a.id).role, 'seller');
  assert.equal(store.find('users', b.id).role, 'seller');
  assert.equal(store.find('users', b.id).businessName, 'Gasan Crafts');
  assert.equal(store.find('users', b.id).email, 'old-b@x.com');
});

test('shop: products validate, save with owner, and block other owners', async () => {
  artisan = await register({ role: 'seller', name: 'Lito Reyes', email: 'lito@x.com', password: 'carve2026a', confirm: 'carve2026a' });
  shop = await register({ role: 'seller', name: 'Ana Cruz', businessName: 'Boac Souvenirs', email: 'ana@x.com', password: 'shop2026ab', confirm: 'shop2026ab' });
  buyer = await register({ role: 'customer', name: 'Tess Manlapaz', email: 'tess@x.com', password: 'tour2026ab', confirm: 'tour2026ab' });
  await assert.rejects(saveProduct(artisan, { name: 'M', price: '0', quantity: '-1', image: 'http://x' }),
    (e) => e instanceof FormError && !!(e.fields.name && e.fields.price && e.fields.quantity && e.fields.image));
  mask = await saveProduct(artisan, { name: 'Morion mask', price: '850', quantity: '2', category: 'Masks', image: img, published: true });
  assert.equal(mask.ownerId, artisan.id); assert.equal(ownerName(artisan.id), 'Lito Reyes'); assert.equal(ownerName(shop.id), 'Boac Souvenirs');
  await assert.rejects(saveProduct(shop, { name: 'Hijack', price: '1', quantity: '1' }, mask.id), /own products/);
  const edited = await saveProduct(artisan, { name: 'Morion mask', price: '900', quantity: '2', category: 'Masks', image: img, published: true }, mask.id);
  assert.equal(edited.price, 900);
});

test('shop: posting an image on a product changes what the catalog sees', async () => {
  const seen = []; const off = shared.subscribe((n) => seen.push(n));
  await saveProduct(artisan, { name: 'Morion mask', price: '900', quantity: '2', category: 'Masks', image: 'data:image/png;base64,iVBOR', published: true }, mask.id);
  off();
  assert.ok(seen.includes('products'));
  assert.equal(shared.find('products', mask.id).image, 'data:image/png;base64,iVBOR');
});

test('rbac: a business seller has the same seller rights as an artisan seller', async () => {
  const own = await saveProduct(shop, { name: 'Souvenir keychain', price: '120', quantity: '5', image: img, published: true });
  assert.equal(own.ownerId, shop.id);
  const m = await saveMaterial(shop, { name: 'Abaca', unit: 'kg', quantity: '2', reorderLevel: '1' });
  await recordProduction(shop, { productId: own.id, made: '1', materialId: m.id, used: '0.5' });
  await deleteMaterial(shop, m.id); await deleteProduct(shop, own.id);
});

test('rbac: customers cannot manage products, images, materials or order statuses', async () => {
  await assert.rejects(saveProduct(buyer, { name: 'Fake', price: '1', quantity: '1', image: img }), /Only Artisan\/Business \(Seller\)/);
  await assert.rejects(saveProduct(buyer, { name: 'Morion mask', price: '1', quantity: '1', image: img, published: true }, mask.id), /Only Artisan\/Business/);
  await assert.rejects(deleteProduct(buyer, mask.id), /Only Artisan\/Business/);
  await assert.rejects(saveMaterial(buyer, { name: 'Wood', unit: 'kg', quantity: '1', reorderLevel: '0' }), /Only Artisan\/Business/);
  await assert.rejects(recordProduction(buyer, { productId: mask.id, made: '1' }), /Only Artisan\/Business/);
  // a page cannot fake the role: the stored account decides
  await assert.rejects(saveProduct({ ...buyer, role: 'seller' }, { name: 'Fake', price: '1', quantity: '1' }), /Only Artisan\/Business/);
});

test('rbac: only customers place orders; sellers and signed-out visitors cannot', async () => {
  const f = { productId: mask.id, quantity: '1', customerName: 'Someone', contact: '09171234567' };
  await assert.rejects(placeOrder(null, f), /Customer account/);
  await assert.rejects(placeOrder(shop, f), /Seller accounts cannot place orders/);
  await assert.rejects(placeOrder({ ...shop, role: 'customer' }, f), /Seller accounts cannot place orders/);
});

test('shop: orders go to the seller, validate input, and completing adjusts stock', async () => {
  await assert.rejects(placeOrder(buyer, { productId: mask.id, quantity: '0', customerName: '', contact: '1', pickupDate: '2000-01-01' }),
    (e) => e instanceof FormError && !!(e.fields.quantity && e.fields.customerName && e.fields.contact && e.fields.pickupDate));
  await assert.rejects(placeOrder(artisan, { productId: mask.id, quantity: '1', customerName: 'Me', contact: '09171234567' }), /own product/);
  const o = await placeOrder(buyer, { productId: mask.id, quantity: '2', customerName: 'Tess Manlapaz', contact: '09171234567' });
  assert.equal(o.sellerId, artisan.id); assert.equal(o.buyerId, buyer.id); assert.equal(o.status, 'pending'); assert.equal(o.total, 1800);
  assert.equal(o.source, 'customer'); assert.equal(o.madeToOrder, false);
  const mto = await placeOrder(buyer, { productId: mask.id, quantity: '5', customerName: 'Tess Manlapaz', contact: 'tess@x.com', notes: 'Gold helmet' });
  assert.equal(mto.madeToOrder, true); // more than the 2 in stock
  const { ordersOf } = await import('../js/shop.js');
  assert.deepEqual(ordersOf(buyer).map((x) => x.id).sort(), [mto.id, o.id].sort());
  assert.deepEqual(ordersOf(artisan), []); // sellers have no customer order history
  await assert.rejects(setOrderStatus(buyer, o.id, 'completed'), /Only Artisan\/Business/);
  await assert.rejects(setOrderStatus(shop, o.id, 'completed'), /own orders/);
  await setOrderStatus(artisan, o.id, 'in_production');
  assert.equal(shared.find('products', mask.id).quantity, 2);
  await setOrderStatus(artisan, o.id, 'completed');
  assert.equal(shared.find('products', mask.id).quantity, 0);
  await setOrderStatus(artisan, o.id, 'completed');
  assert.equal(shared.find('products', mask.id).quantity, 0);
  await setOrderStatus(artisan, o.id, 'ready');
  assert.equal(shared.find('products', mask.id).quantity, 2);
});

test('profile: sellers and customers update their own details; account type stays', async () => {
  const s2 = await updateProfile(shop, { name: 'Ana Cruz', businessName: 'Boac Souvenir House', phone: '0917 555 1234', role: 'customer' });
  assert.equal(s2.businessName, 'Boac Souvenir House'); assert.equal(s2.role, 'seller');
  assert.equal(ownerName(shop.id), 'Boac Souvenir House');
  const c2 = await updateProfile(buyer, { name: 'Tess M.', businessName: 'nope', phone: '' , role: 'seller' });
  assert.equal(c2.name, 'Tess M.'); assert.equal(c2.businessName, ''); assert.equal(c2.role, 'customer');
  await assert.rejects(updateProfile(buyer, { name: 'x', phone: 'abc' }), (e) => e instanceof ValidationError && !!(e.fields.name && e.fields.phone));
});

test('shop: deleting a product is owner-only', async () => {
  await assert.rejects(deleteProduct(shop, mask.id), /own products/);
  await deleteProduct(artisan, mask.id);
  assert.equal(shared.find('products', mask.id), null);
});

let wood, mask2;

test('materials: validate, save with owner, state flags, owner-only', async () => {
  await assert.rejects(saveMaterial(artisan, { name: 'W', unit: '', quantity: '-1', reorderLevel: 'x' }),
    (e) => e instanceof FormError && !!(e.fields.name && e.fields.unit && e.fields.quantity && e.fields.reorderLevel));
  wood = await saveMaterial(artisan, { name: 'Lanete wood', unit: 'kg', quantity: '10', reorderLevel: '3' });
  assert.equal(wood.ownerId, artisan.id); assert.equal(materialState(wood), 'ok');
  assert.equal(materialState({ quantity: 3, reorderLevel: 3 }), 'low'); assert.equal(materialState({ quantity: 0, reorderLevel: 0 }), 'out');
  await assert.rejects(saveMaterial(shop, { name: 'Hijack', unit: 'kg', quantity: '1', reorderLevel: '0' }, wood.id), /own materials/);
  await assert.rejects(adjustMaterial(shop, wood.id, '1', 'add'), /own materials/);
  await assert.rejects(deleteMaterial(shop, wood.id), /own materials/);
});

test('materials: add and use stock, never below zero, decimals stay clean', async () => {
  let m = await adjustMaterial(artisan, wood.id, '2.5', 'use'); assert.equal(m.quantity, 7.5);
  m = await adjustMaterial(artisan, wood.id, '0.1', 'add'); m = await adjustMaterial(artisan, wood.id, '0.2', 'add'); assert.equal(m.quantity, 7.8);
  await assert.rejects(adjustMaterial(artisan, wood.id, '99', 'use'), /Only 7.8 kg/);
  await assert.rejects(adjustMaterial(artisan, wood.id, '0', 'add'), (e) => e instanceof FormError);
  assert.equal(shared.find('materials', wood.id).quantity, 7.8);
});

test('materials: recording finished pieces raises product stock and uses material', async () => {
  mask2 = await saveProduct(artisan, { name: 'Pukpuk carving', price: '500', quantity: '1', published: true });
  await assert.rejects(recordProduction(artisan, { productId: mask2.id, made: '0' }), (e) => e instanceof FormError && !!e.fields.made);
  await assert.rejects(recordProduction(artisan, { productId: mask2.id, made: '2', materialId: wood.id, used: '' }), (e) => !!e.fields.used);
  await assert.rejects(recordProduction(artisan, { productId: mask2.id, made: '2', materialId: wood.id, used: '50' }), (e) => !!e.fields.used);
  assert.equal(shared.find('products', mask2.id).quantity, 1);
  await recordProduction(artisan, { productId: mask2.id, made: '3', materialId: wood.id, used: '1.8' });
  assert.equal(shared.find('products', mask2.id).quantity, 4); assert.equal(shared.find('materials', wood.id).quantity, 6);
  await recordProduction(artisan, { productId: mask2.id, made: '1' });
  assert.equal(shared.find('products', mask2.id).quantity, 5); assert.equal(shared.find('materials', wood.id).quantity, 6);
  await assert.rejects(recordProduction(shop, { productId: mask2.id, made: '1' }), (e) => !!e.fields.productId);
});

const { parseBackup } = await import('../js/store.js');

test('backup: export then restore into an empty store keeps everything', async () => {
  const a = createStore('t5'); await a.ready;
  const u = await a.add('users', { email: 'a@b.co', role: 'artisan', passwordHash: 'h', salt: 's', name: 'A' });
  await a.add('products', { name: 'Mask', image: 'data:image/jpeg;base64,AAAA', ownerId: u.id });
  const file = JSON.stringify(a.exportAll());
  const b = createStore('t6'); await b.ready;
  await b.importAll(file);
  assert.equal(b.list('users').length, 1); assert.equal(b.list('products')[0].image, 'data:image/jpeg;base64,AAAA');
  assert.equal(b.list('users')[0].role, 'seller'); // an old Artisan backup restores as a Seller account
  const c = createStore('t6'); await c.ready;
  assert.equal(c.list('products').length, 1);
  a.close(); b.close(); c.close();
});

test('backup: bad files are rejected and unsafe image values are dropped', async () => {
  assert.throws(() => parseBackup('not json'), /could not be read/);
  assert.throws(() => parseBackup({ app: 'other', version: 1, data: {} }), /not a KAPAS backup/);
  assert.throws(() => parseBackup({ app: 'kapas', version: 1, data: { products: [{ name: 'no id' }] } }), /damaged/);
  assert.throws(() => parseBackup({ app: 'kapas', version: 1, data: { users: [{ id: '1', email: 'x', role: 'admin', passwordHash: 'h', salt: 's' }] } }), /account/);
  const roles = parseBackup({ app: 'kapas', version: 1, data: { users: ['artisan', 'business', 'seller', 'customer'].map((role, i) => ({ id: String(i), email: i + '@x.co', role, passwordHash: 'h', salt: 's' })) } });
  assert.deepEqual(roles.users.map((u) => u.role), ['seller', 'seller', 'seller', 'customer']);
  assert.throws(() => parseBackup({ app: 'kapas', version: 1, data: { orders: [{ id: '1' }, { id: '1' }] } }), /damaged/);
  const ok = parseBackup({ app: 'kapas', version: 1, data: { products: [{ id: '1', image: 'javascript:alert(1)' }, { id: '2', image: 'data:image/png;base64,AA' }] } });
  assert.equal(ok.products[0].image, ''); assert.equal(ok.products[1].image, 'data:image/png;base64,AA'); assert.deepEqual(ok.users, []);
  const s = createStore('t7'); await s.ready;
  await assert.rejects(s.importAll('{"app":"kapas"}'), /not a KAPAS backup/);
  s.close();
});
