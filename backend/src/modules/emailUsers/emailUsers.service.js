/**
 * emailUsers.service.js
 * Servicio para usuarios autorizados del panel de alertas de vehículos.
 * Colección: apps/emails/users/{email}
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const USERS_REF = db.collection("apps").doc("emails").collection("users");
const VEHICLES_REF = db.collection("apps").doc("emails").collection("vehicles");

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
 * Asegura que el usuario exista en apps/emails/users/{email}.
 * Si no existe: crea con email, role, active: true, createdAt.
 * Si existe: merge sin modificar role si ya está definido.
 * @param {string} email - Email normalizado
 * @param {string} role - "admin" | "responsable"
 * @returns {Promise<void>}
 */
async function ensureUser(email, role) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("email requerido");

  const validRoles = ["admin", "responsable"];
  if (!role || !validRoles.includes(role)) {
    throw new Error("role debe ser 'admin' o 'responsable'");
  }

  const docRef = USERS_REF.doc(normalized);
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

  const data = docSnap.data();
  const update = { active: true };
  if (data.role === undefined || data.role === null || data.role === "") {
    update.role = role;
  }
  await docRef.set(update, { merge: true });
}

/**
 * Obtiene el usuario autorizado por email.
 * @param {string} email - Email normalizado
 * @returns {Promise<{ email: string, role: string } | null>}
 */
async function getMe(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const docSnap = await USERS_REF.doc(normalized).get();
  if (!docSnap.exists) return null;

  const data = docSnap.data();
  if (data.active === false) return null;

  return {
    email: data.email || normalized,
    role: data.role || "responsable",
  };
}

/**
 * Obtiene los vehículos visibles para el usuario según su role.
 * admin: toda la colección apps/emails/vehicles.
 * responsable: documentos donde responsables array-contains email.
 * @param {string} email - Email normalizado
 * @param {string} role - "admin" | "responsable"
 * @returns {Promise<Array<object>>}
 */
async function getMyVehicles(email, role) {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  if (role === "admin") {
    const snap = await VEHICLES_REF.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  if (role === "responsable") {
    const snap = await VEHICLES_REF.where("responsables", "array-contains", normalized).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return [];
}

module.exports = {
  normalizeEmail,
  ensureUser,
  getMe,
  getMyVehicles,
};
