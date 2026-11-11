// Pure search, filter and sort helpers used by the catalog and the seller tables. No DOM access.
export const SORTS = {
  newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  oldest: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  stockAsc: (a, b) => a.quantity - b.quantity,
};

// Case-insensitive match of every word in the term against the joined text fields.
export function matches(term, ...fields) {
  const words = String(term || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.map((f) => String(f ?? '')).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function sortBy(list, key) {
  return list.slice().sort(SORTS[key] || SORTS.newest);
}

export const categoriesOf = (products) => [...new Set(products.map((p) => (p.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
