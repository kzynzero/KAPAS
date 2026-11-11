// Seller profile for Artisan/Business (Seller) accounts: name, shop or business name, phone.
import { guard, roleLabel, updateProfile, current, ValidationError } from '../../js/auth.js';
import { adminShell } from '../../js/layout.js';
import { toast, clearErrors, showErrors, $ } from '../../js/ui.js';

const user = await guard(['seller']);
await adminShell('profile.html');

const form = $('profile');
$('role').textContent = roleLabel(user.role) + ' account';
function fill(u) { form.name.value = u.name || ''; form.businessName.value = u.businessName || ''; form.phone.value = u.phone || ''; $('email').value = u.email; }
fill(current() || user);

form.addEventListener('submit', async (e) => {
  e.preventDefault(); clearErrors(form); $('formError').textContent = '';
  const btn = $('saveBtn'); btn.disabled = true;
  try { fill(await updateProfile(user, Object.fromEntries(new FormData(form)))); toast('Profile saved'); }
  catch (err) { err instanceof ValidationError ? showErrors(form, err.fields) : ($('formError').textContent = err.message); }
  btn.disabled = false;
});
