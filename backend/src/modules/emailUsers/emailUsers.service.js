/**
 * emailUsers.service.js
 * Servicio de acceso al panel de alertas de vehículos.
 * Colecciones:
 * - apps/emails/access/{email}
 * - apps/emails/vehicles/{plate}
 * - apps/emails/config (documento de configuración global)
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const ACCESS_REF = db.collection("apps").doc("emails").collection("access");
const VEHICLES_REF = db.collection("apps").doc("emails").collection("vehicles");
// apps/emails/config → se modela como colección "config" con doc "config"
const CONFIG_DOC_REF = db
  .collection("apps")
  .doc("emails")
  .collection("config")
  .doc("config");

/**
 * Normaliza email: trim y toLowerCase.
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (email == null || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Normaliza y deduplica un arreglo de correos.
 * @param {Array<string>} values
 * @returns {string[]}
 */
function normalizeEmailArray(values) {
  if (!Array.isArray(values)) return [];
  const set = new Set();
  for (const raw of values) {
    const n = normalizeEmail(raw);
    if (n) set.add(n);
  }
  return Array.from(set);
}

/**
 * Asegura que el usuario de acceso exista en apps/emails/access/{email}.
 * Si no existe: crea con email, role, active: true, createdAt.
 * Si existe: merge sin modificar role si ya está definido.
 * @param {string} email - Email (se normaliza internamente)
 * @param {string} role - "admin" | "general" | "report" | "responsable"
 * @returns {Promise<void>}
 */
async function ensureUser(email, role) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("email requerido");

  const validRoles = ["admin", "general", "report", "responsable"];
  if (!role || !validRoles.includes(role)) {
    throw new Error("role debe ser 'admin', 'general', 'report' o 'responsable'");
  }

  const docRef = ACCESS_REF.doc(normalized);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    await docRef.set({
      email: normalized,
      role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const data = docSnap.data() || {};
  const update = {};

  // Asegurar email normalizado
  if (!data.email) {
    update.email = normalized;
  }
  // No forzar role si ya existe: la promoción/degradación se hace explícitamente
  if (data.role == null || data.role === "") {
    update.role = role;
  }
  // Si active está indefinido, activamos por defecto al sincronizar
  if (data.active == null) {
    update.active = true;
  }

  if (Object.keys(update).length > 0) {
    await docRef.set(update, { merge: true });
  }
}

/**
 * Obtiene el usuario autorizado por email desde apps/emails/access.
 * Requiere active === true; si no, retorna null.
 * @param {string} email
 * @returns {Promise<{ email: string, role: string } | null>}
 */
async function getMe(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const docSnap = await ACCESS_REF.doc(normalized).get();
  if (!docSnap.exists) return null;

  const data = docSnap.data() || {};
  if (data.active !== true) return null;

  return {
    email: data.email || normalized,
    role: data.role || "responsable",
  };
}

/**
 * Obtiene los vehículos visibles para el usuario según su role.
 * admin/general/report: toda la colección apps/emails/vehicles.
 * responsable: documentos donde responsablesNormalized array-contains email.
 * @param {string} email
 * @param {string} role - "admin" | "general" | "report" | "responsable"
 * @returns {Promise<Array<object>>}
 */
async function getMyVehicles(email, role) {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  if (role === "admin" || role === "general" || role === "report") {
    const snap = await VEHICLES_REF.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  if (role === "responsable") {
    // Preferimos responsablesNormalized para consultas eficientes.
    let snap = await VEHICLES_REF.where("responsablesNormalized", "array-contains", normalized).get();

    // Compatibilidad: si aún no se migró el campo, intentar con responsables.
    if (snap.empty) {
      snap = await VEHICLES_REF.where("responsables", "array-contains", normalized).get();
    }

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return [];
}

/**
 * Sincroniza usuarios de acceso a partir de:
 * - apps/emails/vehicles (responsables/responsablesNormalized)
 * - apps/emails/config (generalRecipients, ccRecipients, reportRecipients)
 *
 * Crea/actualiza documentos en apps/emails/access/{email}.
 * No cambia roles ya asignados explícitamente, solo completa datos faltantes.
 *
 * @returns {Promise<{ created: number, updated: number, totalEmails: number }>}
 */
async function syncAccessUsers() {
  const allEmailsSet = new Set();
  const candidateRoles = new Map(); // email -> desiredRole (solo para nuevos docs)

  // 1) Recorrer todos los vehículos y normalizar responsables/responsablesNormalized
  const vehiclesSnap = await VEHICLES_REF.get();
  const batchUpdates = [];

  vehiclesSnap.forEach((doc) => {
    const data = doc.data() || {};
    const rawResponsables = Array.isArray(data.responsables) ? data.responsables : [];
    const storedNormalized = Array.isArray(data.responsablesNormalized)
      ? data.responsablesNormalized
      : [];

    const normalizedFromRaw = normalizeEmailArray(rawResponsables);
    const normalizedStored = normalizeEmailArray(storedNormalized);

    const mergedSet = new Set([...normalizedFromRaw, ...normalizedStored]);
    const merged = Array.from(mergedSet);

    merged.forEach((email) => allEmailsSet.add(email));

    const needsUpdate =
      merged.length > 0 &&
      (normalizedStored.length !== merged.length ||
        normalizedStored.some((e, idx) => e !== merged[idx]));

    if (needsUpdate) {
      batchUpdates.push({
        ref: doc.ref,
        data: { responsablesNormalized: merged },
      });
    }
  });

  // Aplicar updates en vehículos en batches para no superar límites
  if (batchUpdates.length > 0) {
    const MAX_BATCH = 500;
    for (let i = 0; i < batchUpdates.length; i += MAX_BATCH) {
      const slice = batchUpdates.slice(i, i + MAX_BATCH);
      const batch = db.batch();
      slice.forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
      await batch.commit();
    }
  }

  // 2) Leer configuración global apps/emails/config
  const configSnap = await CONFIG_DOC_REF.get();
  if (configSnap.exists) {
    const cfg = configSnap.data() || {};
    const general = normalizeEmailArray(cfg.generalRecipients || []);
    const cc = normalizeEmailArray(cfg.ccRecipients || []);
    const report = normalizeEmailArray(cfg.reportRecipients || []);

    const preferRole = (email, role) => {
      // Preferencia básica: admin > general > report > responsable
      const order = { admin: 3, general: 2, report: 1, responsable: 0 };
      const current = candidateRoles.get(email);
      if (!current || order[role] > order[current]) {
        candidateRoles.set(email, role);
      }
    };

    general.forEach((email) => {
      allEmailsSet.add(email);
      preferRole(email, "general");
    });
    cc.forEach((email) => {
      allEmailsSet.add(email);
      preferRole(email, "general");
    });
    report.forEach((email) => {
      allEmailsSet.add(email);
      preferRole(email, "report");
    });
  }

  const allEmails = Array.from(allEmailsSet);
  let created = 0;
  let updated = 0;

  // 3) Asegurar documentos en apps/emails/access/{email}
  for (const email of allEmails) {
    const docRef = ACCESS_REF.doc(email);
    const snap = await docRef.get();

    if (!snap.exists) {
      const role = candidateRoles.get(email) || "responsable";
      await docRef.set({
        email,
        role,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      created += 1;
      continue;
    }

    const data = snap.data() || {};
    const update = {};

    if (!data.email) {
      update.email = email;
    }
    if (data.active == null) {
      update.active = true;
    }

    // No sobreescribimos role si ya existe; si está vacío, usamos el candidato si hay.
    if (data.role == null || data.role === "") {
      const candidateRole = candidateRoles.get(email) || "responsable";
      update.role = candidateRole;
    }

    if (Object.keys(update).length > 0) {
      await docRef.set(update, { merge: true });
      updated += 1;
    }
  }

  return { created, updated, totalEmails: allEmails.length };
}

module.exports = {
  normalizeEmail,
  ensureUser,
  getMe,
  getMyVehicles,
  syncAccessUsers,
};
