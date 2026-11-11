// Accounts for this browser. Passwords are salted and hashed with PBKDF2 (Web Crypto) before
// they are stored, and every protected page calls guard(). Because there is no server, accounts
// live only on this device: this is local sign-in, not shared hosting-grade security.
import { store } from './store.js';

const SESSION_KEY = 'kapas.session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const MAX_TRIES = 5, LOCK_MS = 60 * 1000;
const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export class ValidationError extends Error {
  constructor(fields) { super('Check the highlighted fields.'); this.fields = fields; }
}

async function hash(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations: 210000 }, key, 256);
  return toB64(bits);
}
// Exactly two account types. Artisans and businesses are both sellers: same dashboard, same rights.
export const ROLES = { seller: 'Artisan/Business (Seller)', customer: 'Customer (Buyer)' };
const LEGACY_SELLER = ['artisan', 'business']; // older accounts, before the two types were merged
export const normalizeRole = (r) => (LEGACY_SELLER.includes(r) ? 'seller' : r);
export const roleLabel = (r) => ROLES[normalizeRole(r)] || 'Unknown account';
export const isSeller = (u) => !!u && normalizeRole(u.role) === 'seller';
export const isCustomer = (u) => !!u && normalizeRole(u.role) === 'customer';

const publicUser = ({ passwordHash, salt, ...rest }) => ({ ...rest, role: normalizeRole(rest.role) });

// Rewrites old Artisan and Business accounts as Seller accounts, once, keeping every other detail.
let migrated = null;
export function authReady() {
  return (migrated ||= store.ready.then(async () => {
    for (const u of store.where('users', (x) => LEGACY_SELLER.includes(x.role))) await store.update('users', u.id, { role: 'seller' });
  }));
}
const startSession = (user) =>
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, expires: Date.now() + SESSION_MS }));

export function validateRegistration(f, existingEmails = []) {
  const e = {};
  if (!Object.hasOwn(ROLES, f.role)) e.role = 'Choose an account type.';
  if ((f.name || '').trim().length < 2) e.name = 'Enter your full name.';
  if ((f.businessName || '').trim().length > 80) e.businessName = 'Keep the shop or business name under 80 characters.';
  const email = (f.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Enter a valid email address.';
  else if (existingEmails.includes(email)) e.email = 'An account with this email already exists.';
  if (f.phone && !/^[+\d][\d\s-]{6,17}$/.test(f.phone.trim())) e.phone = 'Use digits only, for example 0917 123 4567.';
  if (!f.password || f.password.length < 8 || !/[a-z]/i.test(f.password) || !/\d/.test(f.password))
    e.password = 'Use at least 8 characters with a letter and a number.';
  if (f.password !== f.confirm) e.confirm = 'Passwords do not match.';
  return e;
}

export async function register(f) {
  await authReady();
  const errors = validateRegistration(f, store.list('users').map((u) => u.email));
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const user = await store.add('users', {
    role: f.role, name: f.name.trim(), email: f.email.trim().toLowerCase(),
    businessName: f.role === 'seller' ? (f.businessName || '').trim() : '', phone: (f.phone || '').trim(),
    salt, passwordHash: await hash(f.password, salt),
  });
  startSession(user);
  return publicUser(user);
}

export async function login(emailRaw, password) {
  await authReady();
  const email = (emailRaw || '').trim().toLowerCase();
  const lockKey = 'kapas.lock.' + email;
  const lock = JSON.parse(localStorage.getItem(lockKey) || '{"n":0,"until":0}');
  if (lock.until > Date.now()) throw new Error('Too many attempts. Try again in a minute.');
  const user = store.where('users', (u) => u.email === email)[0];
  const ok = user && (await hash(password || '', user.salt)) === user.passwordHash;
  if (!ok) {
    const n = lock.n + 1;
    localStorage.setItem(lockKey, JSON.stringify({ n: n >= MAX_TRIES ? 0 : n, until: n >= MAX_TRIES ? Date.now() + LOCK_MS : 0 }));
    throw new Error('Email or password is incorrect.');
  }
  localStorage.removeItem(lockKey);
  startSession(user);
  return publicUser(user);
}

export function current() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s || s.expires < Date.now()) return null;
    const user = store.find('users', s.userId);
    return user ? publicUser(user) : null;
  } catch { return null; }
}
export const logout = () => localStorage.removeItem(SESSION_KEY);
// Sellers land on the Seller Dashboard, customers on the Customer Dashboard.
export const homeFor = (u) => (isCustomer(u) ? 'customer.html' : 'dashboard.html');

// Profile changes. Email, password and account type are not changed here.
export function checkProfile(f) {
  const e = {};
  if ((f.name || '').trim().length < 2) e.name = 'Enter your full name.';
  if ((f.businessName || '').trim().length > 80) e.businessName = 'Keep the shop or business name under 80 characters.';
  if (f.phone && !/^[+\d][\d\s-]{6,17}$/.test(f.phone.trim())) e.phone = 'Use digits only, for example 0917 123 4567.';
  return e;
}
export async function updateProfile(user, f) {
  await authReady();
  const me = user && store.find('users', user.id);
  if (!me) throw new Error('Sign in again to change your profile.');
  const errors = checkProfile(f);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const patch = { name: f.name.trim(), phone: (f.phone || '').trim() };
  if (isSeller(me)) patch.businessName = (f.businessName || '').trim();
  return publicUser(await store.update('users', me.id, patch));
}

// Call at the top of every protected page: guard(['seller']), guard(['customer']) or guard() for any signed-in user.
export async function guard(roles) {
  await authReady();
  const user = current();
  if (!user) {
    location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
    return new Promise(() => {});
  }
  if (roles && !roles.includes(user.role)) { location.replace(homeFor(user)); return new Promise(() => {}); }
  window.addEventListener('storage', (e) => { if (e.key === SESSION_KEY && !current()) location.replace('login.html'); });
  return user;
}
