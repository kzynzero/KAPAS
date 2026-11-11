// Browser data layer. IndexedDB keeps records on this device; a BroadcastChannel tells every
// other open tab to reload and re-render, so a change made on one page shows up on the rest.
const COLLECTIONS = ['users', 'products', 'materials', 'orders'];
const IMAGE = /^data:image\/(jpeg|png|webp);base64,/;
export const MAX_PHOTOS = 6; // photos per product
// Account types: 'seller' (Artisan/Business) and 'customer' (Buyer). Older backups used 'artisan' and 'business'.
const LEGACY_SELLER = ['artisan', 'business'];
const ACCOUNT_ROLES = ['seller', 'customer', ...LEGACY_SELLER];
 
// Checks a backup file and returns clean collections, or throws an Error that says what is wrong.
export function parseBackup(raw) {
  let b;
  try { b = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('That file is not a KAPAS backup. It could not be read.'); }
  if (!b || b.app !== 'kapas' || b.version !== 1 || typeof b.data !== 'object' || !b.data) throw new Error('That file is not a KAPAS backup.');
  const out = {};
  for (const c of COLLECTIONS) {
    const rows = b.data[c] ?? [];
    if (!Array.isArray(rows) || rows.length > 5000) throw new Error('The backup has a damaged ' + c + ' list.');
    const ids = new Set();
    out[c] = rows.map((r) => {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || ids.has(r.id)) throw new Error('The backup has a damaged ' + c + ' record.');
      ids.add(r.id);
      if (c === 'users' && !(typeof r.email === 'string' && ACCOUNT_ROLES.includes(r.role) && typeof r.passwordHash === 'string' && typeof r.salt === 'string'))
        throw new Error('The backup has a damaged account record.');
      if (c === 'users' && LEGACY_SELLER.includes(r.role)) return { ...r, role: 'seller' }; // old Artisan / Business backups
      if (c === 'products' && Array.isArray(r.images)) {
        const images = r.images.filter((s) => typeof s === 'string' && IMAGE.test(s)).slice(0, MAX_PHOTOS);
        return { ...r, images, image: images[0] || '' };
      }
      return c === 'products' && r.image && !IMAGE.test(r.image) ? { ...r, image: '' } : r;
    });
  }
  return out;
}
 
export function createStore(dbName = 'kapas') {
  const data = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const listeners = new Set();
  const channel = new BroadcastChannel(dbName + '-sync');
  channel.unref?.(); // lets Node tests exit; no effect in browsers
  let db;
 
  const emit = (name) => listeners.forEach((fn) => fn(name));
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('collections');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const load = (names) => new Promise((resolve, reject) => {
    const tx = db.transaction('collections');
    names.forEach((n) => {
      const r = tx.objectStore('collections').get(n);
      r.onsuccess = () => { data[n] = r.result || []; };
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
 
  // Read, change and write one collection inside a single transaction, so two tabs
  // saving at the same moment cannot overwrite each other.
  const mutate = (name, fn) => new Promise((resolve, reject) => {
    const tx = db.transaction('collections', 'readwrite');
    const os = tx.objectStore('collections');
    let rows, result;
    os.get(name).onsuccess = (e) => {
      rows = e.target.result || [];
      try { result = fn(rows); } catch (err) { reject(err); tx.abort(); return; }
      os.put(rows, name);
    };
    tx.oncomplete = () => { data[name] = rows; channel.postMessage(name); emit(name); resolve(result); };
    tx.onabort = () => reject(tx.error || new Error('Could not save. Browser storage may be full.'));
  });
 
  const api = {
    ready: null,
    list: (name) => data[name].slice(),
    find: (name, id) => data[name].find((r) => r.id === id) || null,
    where: (name, test) => data[name].filter(test),
    add: (name, row) => mutate(name, (rows) => {
      const rec = { id: crypto.randomUUID(), createdAt: Date.now(), ...row };
      rows.push(rec);
      return rec;
    }),
    update: (name, id, patch) => mutate(name, (rows) => {
      const rec = rows.find((r) => r.id === id);
      if (!rec) throw new Error('That record no longer exists.');
      return Object.assign(rec, patch, { updatedAt: Date.now() });
    }),
    remove: (name, id) => mutate(name, (rows) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('That record no longer exists.');
      rows.splice(i, 1);
    }),
    exportAll: () => ({ app: 'kapas', version: 1, exportedAt: new Date().toISOString(),
      data: Object.fromEntries(COLLECTIONS.map((c) => [c, data[c]])) }),
    // Replaces everything on this device with the backup, in one transaction.
    importAll: (raw) => new Promise((resolve, reject) => {
      let clean; try { clean = parseBackup(raw); } catch (err) { return reject(err); }
      const tx = db.transaction('collections', 'readwrite');
      COLLECTIONS.forEach((c) => tx.objectStore('collections').put(clean[c], c));
      tx.oncomplete = () => { COLLECTIONS.forEach((c) => { data[c] = clean[c]; channel.postMessage(c); emit(c); }); resolve(); };
      tx.onabort = () => reject(tx.error || new Error('Could not restore. Browser storage may be full.'));
    }),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    close: () => { channel.close(); db && db.close(); },
  };
  api.ready = open().then((d) => { db = d; return load(COLLECTIONS); });
  channel.onmessage = async (e) => { await api.ready; await load([e.data]); emit(e.data); };
  return api;
}
 
export const store = createStore('kapas');