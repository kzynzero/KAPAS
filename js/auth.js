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
const publicUser = ({ passwordHash, salt, ...rest }) => rest;
const startSession = (user) =>
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, expires: Date.now() + SESSION_MS }));

export function validateRegistration(f, existingEmails = []) {
  const e = {};
  if (!['artisan', 'business'].includes(f.role)) e.role = 'Choose an account type.';
  if ((f.name || '').trim().length < 2) e.name = 'Enter your full name.';
  if (f.role === 'business' && (f.businessName || '').trim().length < 2) e.businessName = 'Enter your business name.';
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
  await store.ready;
  const errors = validateRegistration(f, store.list('users').map((u) => u.email));
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const user = await store.add('users', {
    role: f.role, name: f.name.trim(), email: f.email.trim().toLowerCase(),
    businessName: f.role === 'business' ? f.businessName.trim() : '', phone: (f.phone || '').trim(),
    salt, passwordHash: await hash(f.password, salt),
  });
  startSession(user);
  return publicUser(user);
}

export async function login(emailRaw, password) {
  await store.ready;
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
export const homeFor = () => 'dashboard.html';

// Call at the top of every protected page: guard(['artisan']) or guard() for any signed-in user.
export async function guard(roles) {
  await store.ready;
  const user = current();
  if (!user) {
    location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
    return new Promise(() => {});
  }
  if (roles && !roles.includes(user.role)) { location.replace(homeFor(user)); return new Promise(() => {}); }
  window.addEventListener('storage', (e) => { if (e.key === SESSION_KEY && !current()) location.replace('login.html'); });
  return user;
}
