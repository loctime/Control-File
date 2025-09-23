#!/usr/bin/env node
/*
  Uso:
    node scripts/set-claims.js --uid <UID> --apps controlfile,controlaudit,controldoc --plans controlfile=pro;controlaudit=basic;controldoc=trial
    node scripts/set-claims.js --email <correo@dominio> --apps controlfile

  Requisitos:
    - FB_ADMIN_IDENTITY en el entorno (JSON de service account del proyecto de Auth central)
*/

require('dotenv').config();
const admin = require('firebase-admin');

function getArg(name, fallback) {
  const idx = process.argv.findIndex(a => a === name || a.startsWith(name + '='));
  if (idx === -1) return fallback;
  const eq = process.argv[idx].indexOf('=');
  if (eq !== -1) return process.argv[idx].slice(eq + 1);
  return process.argv[idx + 1] || fallback;
}

async function main() {
  const identityJson = process.env.FB_ADMIN_IDENTITY;
  if (!identityJson) {
    console.error('Falta FB_ADMIN_IDENTITY en el entorno.');
    process.exit(1);
  }

  let credentials;
  try {
    credentials = JSON.parse(identityJson);
  } catch (e) {
    console.error('FB_ADMIN_IDENTITY no es un JSON válido:', e.message);
    process.exit(1);
  }

  // Inicializar una app dedicada solo para Auth central
  const authApp = admin.initializeApp({
    credential: admin.credential.cert(credentials),
  }, 'claimsAuthApp');

  const auth = authApp.auth();

  const uidArg = getArg('--uid');
  const emailArg = getArg('--email');
  const appsArg = getArg('--apps', 'controlfile');
  const plansArg = getArg('--plans');
  const merge = getArg('--merge', 'true') !== 'false';

  if (!uidArg && !emailArg) {
    console.error('Debes pasar --uid <UID> o --email <correo>');
    process.exit(1);
  }

  let uid = uidArg;
  if (!uid && emailArg) {
    const user = await auth.getUserByEmail(emailArg);
    uid = user.uid;
  }

  const allowedApps = appsArg
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let plans;
  if (plansArg) {
    // Formato esperado: controlfile=pro;controlaudit=basic
    plans = plansArg.split(';').reduce((acc, pair) => {
      const [k, v] = pair.split('=').map(s => s && s.trim());
      if (k && v) acc[k] = v;
      return acc;
    }, {});
  }

  let existing = {};
  if (merge) {
    try {
      const user = await auth.getUser(uid);
      existing = user.customClaims || {};
    } catch (_) {}
  }

  const claims = { ...existing, allowedApps };
  if (plans) claims.plans = { ...(existing.plans || {}), ...plans };

  await auth.setCustomUserClaims(uid, claims);

  console.log('✅ Claims actualizados para', uid);
  console.log(JSON.stringify(claims, null, 2));
}

main().catch(err => {
  console.error('Error asignando claims:', err);
  process.exit(1);
});


