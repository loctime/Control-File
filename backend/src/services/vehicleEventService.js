/**
 * vehicleEventService.js
 * Servicio para persistir eventos de vehículos y actualizar resumen por patente.
 * Rutas: apps/emails/vehicleEvents/{eventId}, apps/emails/vehicles/{plate}
 */

const crypto = require("crypto");
const admin = require("firebase-admin");

function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

/**
 * Genera un eventId determinístico para deduplicación.
 * @param {string} plate - Patente del vehículo
 * @param {string} eventTimestamp - ISO timestamp del evento
 * @param {string} rawLine - Línea cruda del email
 * @returns {string} Hash SHA256 truncado (primeros 32 chars hex)
 */
function generateDeterministicEventId(plate, eventTimestamp, rawLine) {
  const payload = `${plate}|${eventTimestamp}|${rawLine || ""}`;
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Guarda eventos en apps/emails/vehicleEvents.
 * No duplica eventos existentes.
 * @param {Array<object>} events - Array de eventos (del parser)
 * @param {string} messageId - ID del email
 * @param {string} source - Origen (ej: "outlook-local")
 * @returns {{ created: number, skipped: number }}
 */
async function saveVehicleEvents(events, messageId, source) {
  const db = getDb();
  const baseRef = db.collection("apps").doc("emails").collection("vehicleEvents");

  let created = 0;
  let skipped = 0;

  for (const event of events) {
    const eventId = generateDeterministicEventId(
      event.plate,
      event.eventTimestamp,
      event.rawLine
    );

    const docRef = baseRef.doc(eventId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      skipped++;
      continue;
    }

    await docRef.set({
      ...event,
      messageId: messageId || null,
      source: source || "outlook-local",
      eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    created++;
  }

  return { created, skipped };
}

/**
 * Crea o actualiza el documento del vehículo en apps/emails/vehicles/{plate}.
 * @param {object} event - Evento parseado
 */
async function upsertVehicle(event) {
  const db = getDb();
  const plate = event.plate;
  if (!plate) return;

  const normalizedPlate = plate.replace(/\s+/g, "").toUpperCase();
  const docRef = db.collection("apps").doc("emails").collection("vehicles").doc(normalizedPlate);

  const docSnap = await docRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!docSnap.exists) {
    await docRef.set({
      plate: normalizedPlate,
      brand: event.brand || "",
      model: event.model || "",
      lastLocation: event.location || "",
      lastSpeed: event.speed,
      lastEventTimestamp: event.eventTimestamp,
      totalEvents: 1,
      totalSpeedingEvents: 1,
      updatedAt: now,
      createdAt: now,
    });
  } else {
    await docRef.update({
      brand: event.brand || docSnap.data().brand,
      model: event.model || docSnap.data().model,
      lastLocation: event.location || docSnap.data().lastLocation || "",
      lastSpeed: event.speed,
      lastEventTimestamp: event.eventTimestamp,
      totalEvents: admin.firestore.FieldValue.increment(1),
      totalSpeedingEvents: admin.firestore.FieldValue.increment(1),
      updatedAt: now,
    });
  }
}

module.exports = {
  generateDeterministicEventId,
  saveVehicleEvents,
  upsertVehicle,
};
