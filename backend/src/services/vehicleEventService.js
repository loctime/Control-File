/**
 * vehicleEventService.js
 * Servicio para persistir eventos de vehículos y actualizar resumen por patente.
 * Rutas: apps/emails/vehicleEvents/{eventId}, apps/emails/vehicles/{plate}
 */

const crypto = require("crypto");
const admin = require("firebase-admin");

const MAX_BATCH_SIZE = 500;

function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

/**
 * Normaliza patente: sin espacios, uppercase.
 */
function normalizePlate(plate) {
  if (!plate || typeof plate !== "string") return "";
  return plate.replace(/\s+/g, "").toUpperCase();
}

/**
 * Obtiene el documento del vehículo si existe.
 * @param {string} plate - Patente (normalizada o raw)
 * @returns {Promise<object|null>} Datos del vehículo o null si no existe
 */
async function getVehicle(plate) {
  if (!plate) return null;
  const db = getDb();
  const normalized = normalizePlate(plate);
  const docSnap = await db
    .collection("apps")
    .doc("emails")
    .collection("vehicles")
    .doc(normalized)
    .get();
  if (!docSnap.exists) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Genera un eventId determinístico para deduplicación.
 * @param {string} plate - Patente del vehículo
 * @param {string} eventTimestamp - ISO timestamp del evento (con offset)
 * @param {string} rawLine - Línea cruda del email
 * @returns {string} Hash SHA256 truncado (primeros 32 chars hex)
 */
function generateDeterministicEventId(plate, eventTimestamp, rawLine) {
  const payload = `${plate}|${eventTimestamp}|${rawLine || ""}`;
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Guarda eventos en apps/emails/vehicleEvents usando batch writes.
 * Deduplicación automática por eventId determinístico.
 * @param {Array<object>} events - Array de eventos (del parser)
 * @param {string} messageId - ID del email
 * @param {string} source - Origen (ej: "outlook-local")
 * @returns {{ created: number, skipped: number }} created = escritos, skipped = 0 (batch sin lecturas)
 */
async function saveVehicleEvents(events, messageId, source) {
  if (!events || events.length === 0) return { created: 0, skipped: 0 };

  const db = getDb();
  const baseRef = db.collection("apps").doc("emails").collection("vehicleEvents");

  const batches = [];
  let currentBatch = db.batch();
  let opCount = 0;

  for (const event of events) {
    const eventId = generateDeterministicEventId(
      event.plate,
      event.eventTimestamp,
      event.rawLine
    );

    const docRef = baseRef.doc(eventId);
    currentBatch.set(docRef, {
      ...event,
      messageId: messageId || null,
      source: source || "outlook-local",
      eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    opCount++;

    if (opCount >= MAX_BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) batches.push(currentBatch);

  for (const batch of batches) {
    await batch.commit();
  }

  return { created: events.length, skipped: 0 };
}

/**
 * Crea o actualiza el documento del vehículo en apps/emails/vehicles/{plate}.
 * No sobrescribe brand/model si el evento viene incompleto.
 * @param {object} event - Evento parseado
 */
async function upsertVehicle(event) {
  const db = getDb();
  const rawPlate = event.plate;
  if (!rawPlate) return;

  const plate = normalizePlate(rawPlate);
  const docRef = db.collection("apps").doc("emails").collection("vehicles").doc(plate);

  const docSnap = await docRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const hasValidBrand = event.brand && String(event.brand).trim().length > 0;
  const hasValidModel = event.model && String(event.model).trim().length > 0;
  const isSpeedingEvent = event.eventCategory === "exceso_velocidad";

  if (!docSnap.exists) {
    await docRef.set({
      plate,
      brand: hasValidBrand ? event.brand.trim() : "",
      model: hasValidModel ? event.model.trim() : "",
      lastLocation: event.location || "",
      lastSpeed: event.speed,
      lastEventTimestamp: event.eventTimestamp,
      totalEvents: 1,
      totalSpeedingEvents: isSpeedingEvent ? 1 : 0,
      updatedAt: now,
      createdAt: now,
    });
  } else {
    const existing = docSnap.data();
    const updates = {
      lastLocation: event.location || existing.lastLocation || "",
      lastSpeed: event.speed,
      lastEventTimestamp: event.eventTimestamp,
      totalEvents: admin.firestore.FieldValue.increment(1),
      updatedAt: now,
    };

    if (hasValidBrand) updates.brand = event.brand.trim();
    if (hasValidModel) updates.model = event.model.trim();

    if (isSpeedingEvent) {
      updates.totalSpeedingEvents = admin.firestore.FieldValue.increment(1);
    }

    await docRef.update(updates);
  }
}

/**
 * Formatea fecha como YYYY-MM-DD.
 */
function formatDateKey(d) {
  const date = d instanceof Date ? d : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Crea o actualiza el documento diario en
 * /apps/emails/dailyAlerts/{YYYY-MM-DD}/vehicles/{plate}
 * @param {string} dateKey - Fecha en formato YYYY-MM-DD
 * @param {string} plate - Patente normalizada
 * @param {object} vehicle - Datos del vehículo (plate, brand, model, responsables)
 * @param {object} event - Evento a agregar
 */
async function upsertDailyAlert(dateKey, plate, vehicle, event) {
  const db = getDb();
  const normalized = normalizePlate(plate);
  const vehiclesRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("vehicles")
    .doc(normalized);

  const docSnap = await vehiclesRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const responsables = Array.isArray(vehicle.responsables) ? vehicle.responsables : [];

  const eventSummary = {
    eventId: event.eventId,
    speed: event.speed,
    eventTimestamp: event.eventTimestamp,
    location: event.location || "",
    severity: event.severity || "info",
  };

  if (!docSnap.exists) {
    await vehiclesRef.set({
      plate: normalized,
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      responsables,
      eventCount: 1,
      events: [eventSummary],
      alertSent: false,
      createdAt: now,
    });
  } else {
    await vehiclesRef.update({
      eventCount: admin.firestore.FieldValue.increment(1),
      events: admin.firestore.FieldValue.arrayUnion(eventSummary),
    });
  }
}

module.exports = {
  generateDeterministicEventId,
  saveVehicleEvents,
  upsertVehicle,
  getVehicle,
  upsertDailyAlert,
  formatDateKey,
  normalizePlate,
};
