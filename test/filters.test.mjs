// Search, filter and sort helpers used by the catalog, products, materials and orders pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { matches, sortBy, categoriesOf } from '../js/filters.js';

const items = [
  { name: 'Morion mask', price: 1200, quantity: 2, createdAt: 1, category: 'Masks' },
  { name: 'Keychain', price: 120, quantity: 40, createdAt: 3, category: 'Accessories' },
  { name: 'Centurion plaque', price: 850, quantity: 0, createdAt: 2, category: ' Masks ' },
];

test('search: every word must appear, case-insensitive, across fields', () => {
  assert.equal(matches('', 'anything'), true);
  assert.equal(matches('MORION', 'Morion mask'), true);
  assert.equal(matches('mask maria', 'Morion mask', 'by Maria Santos'), true);
  assert.equal(matches('mask pedro', 'Morion mask', 'by Maria Santos'), false);
});

test('sort: newest, price both ways, name and lowest stock', () => {
  assert.deepEqual(sortBy(items, 'newest').map((p) => p.createdAt), [3, 2, 1]);
  assert.deepEqual(sortBy(items, 'priceAsc').map((p) => p.price), [120, 850, 1200]);
  assert.deepEqual(sortBy(items, 'priceDesc').map((p) => p.price), [1200, 850, 120]);
  assert.deepEqual(sortBy(items, 'name').map((p) => p.name), ['Centurion plaque', 'Keychain', 'Morion mask']);
  assert.deepEqual(sortBy(items, 'stockAsc').map((p) => p.quantity), [0, 2, 40]);
  assert.deepEqual(sortBy(items, 'unknown').map((p) => p.createdAt), [3, 2, 1]);
  assert.equal(items[0].createdAt, 1, 'sorting must not reorder the original list');
});

test('categories: unique, trimmed, sorted, blanks dropped', () => {
  assert.deepEqual(categoriesOf([...items, { category: '' }]), ['Accessories', 'Masks']);
});
