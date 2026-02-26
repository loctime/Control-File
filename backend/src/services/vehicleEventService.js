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
 * Normaliza patente: elimina espacios, guiones y caracteres especiales, convierte a uppercase.
 * Garantiza consistencia para evitar documentos duplicados en Firestore.
 * 
 * Ejemplos:
 * - "af-999-ef" → "AF999EF"
 * - "AF 999 EF" → "AF999EF"
 * - "af 999 ef" → "AF999EF"
 * - "AB-123-CD" → "AB123CD"
 */
function normalizePlate(plate) {
  if (!plate || typeof plate !== "string") return "";
  return plate
    .replace(/[^a-zA-Z0-9]/g, "") // Elimina espacios, guiones y caracteres especiales
    .toUpperCase()
    .trim();
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
 * Modelo: type, sourceEmailType, reason, vehicleRegistered, speed, eventTimestamp, etc.
 * @param {Array<object>} events - Array de eventos (normalizados, con vehicleRegistered)
 * @param {string} messageId - ID del email
 * @param {string} source - Origen (ej: "outlook-local")
 * @returns {{ created: number, skipped: number }} created = escritos, skipped = 0
 */
async function saveVehicleEvents(events, messageId, source) {
  if (!events || events.length === 0) return { created: 0, skipped: 0 };

  const db = getDb();
  const baseRef = db.collection("apps").doc("emails").collection("vehicleEvents");

  const toWrite = [];
  let skipped = 0;

  for (const event of events) {
    const eventId = event.eventId || generateDeterministicEventId(
      event.plate,
      event.eventTimestamp,
      event.rawLine
    );

    const docRef = baseRef.doc(eventId);
    const existing = await docRef.get();
    if (existing.exists) {
      skipped++;
      continue;
    }

    const dateKey =
      event.eventTimestamp && /^\d{4}-\d{2}-\d{2}/.test(String(event.eventTimestamp))
        ? String(event.eventTimestamp).slice(0, 10)
        : formatDateKey(new Date());

    const docData = {
      ...event,
      type: event.type ?? (event.eventCategory === "exceso_velocidad" ? "exceso" : "exceso"),
      sourceEmailType: event.sourceEmailType ?? "excesos_del_dia",
      reason: event.reason ?? null,
      vehicleRegistered: event.vehicleRegistered ?? true,
      messageId: messageId || null,
      source: source || "outlook-local",
      eventId,
      dateKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    toWrite.push({ ref: docRef, data: docData });
  }

  const batches = [];
  let currentBatch = db.batch();
  let opCount = 0;

  for (const { ref, data } of toWrite) {
    currentBatch.set(ref, data);
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

  return { created: toWrite.length, skipped };
}

/**
 * Crea el documento del vehículo en apps/emails/vehicles/{plate} con datos mínimos del evento.
 * @param {object} event - Evento parseado/normalizado
 * @returns {object} Datos del vehículo creado
 */
async function createVehicleFromEvent(event) {
  const db = getDb();
  const rawPlate = event.plate;
  if (!rawPlate) return null;

  const plate = normalizePlate(rawPlate);
  const docRef = db.collection("apps").doc("emails").collection("vehicles").doc(plate);
  const docSnap = await docRef.get();
  if (docSnap.exists) return { id: docSnap.id, ...docSnap.data() };

  const now = admin.firestore.FieldValue.serverTimestamp();
  const hasValidBrand = event.brand && String(event.brand).trim().length > 0;
  const hasValidModel = event.model && String(event.model).trim().length > 0;
  const isSpeedingEvent = event.type === "exceso" || event.eventCategory === "exceso_velocidad";

  await docRef.set({
    plate,
    brand: hasValidBrand ? event.brand.trim() : "",
    model: hasValidModel ? event.model.trim() : "",
    lastLocation: event.location || "",
    lastSpeed: event.speed ?? null,
    lastEventTimestamp: event.eventTimestamp || null,
    totalEvents: 1,
    totalSpeedingEvents: isSpeedingEvent ? 1 : 0,
    updatedAt: now,
    createdAt: now,
  });

  return { id: plate, plate, brand: event.brand || "", model: event.model || "" };
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
  const isSpeedingEvent =
    event.type === "exceso" || event.eventCategory === "exceso_velocidad";

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
 * Determina la severidad según el tipo de evento.
 * @param {string} eventType - Tipo de evento
 * @returns {string} "critico" | "administrativo"
 */
function getSeverityByType(eventType) {
  if (eventType === "exceso") {
    return "critico";
  }
  // Todos los demás tipos son administrativos
  return "administrativo";
}

/**
 * Actualiza el documento meta del día usando FieldValue.increment.
 * Idempotente: solo debe llamarse cuando isNewEvent === true.
 *
 * Estructura meta: dateKey, totalVehicles, totalEvents, totalCriticos,
 * totalAdvertencias, totalAdministrativos, vehiclesWithCritical, lastUpdatedAt.
 *
 * @param {string} dateKey - Fecha YYYY-MM-DD
 * @param {object} eventSummary - Evento con severity
 * @param {object} opts - { isNewEvent: boolean, isNewVehicle: boolean, hadCriticalBefore: boolean }
 */
async function updateDailyMeta(dateKey, eventSummary, opts) {
  if (!opts || opts.isNewEvent !== true) return;

  const db = getDb();
  const metaRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("meta")
    .doc("meta");

  const severity = eventSummary.severity || "administrativo";
  const FieldValue = admin.firestore.FieldValue;
  const eventType = eventSummary.type || "exceso";
  const summaryKey = normalizeEventTypeForSummary(eventType);
  const metaTypeField = getMetaFieldForType(summaryKey);

  const update = {
    dateKey,
    lastUpdatedAt: FieldValue.serverTimestamp(),
    totalEvents: FieldValue.increment(1),
    [metaTypeField]: FieldValue.increment(1),
  };

  if (opts.isNewVehicle) {
    update.totalVehicles = FieldValue.increment(1);
  }

  if (severity === "critico") {
    update.totalCriticos = FieldValue.increment(1);
    if (opts.isNewVehicle || !opts.hadCriticalBefore) {
      update.vehiclesWithCritical = FieldValue.increment(1);
    }
  } else if (severity === "advertencia") {
    update.totalAdvertencias = FieldValue.increment(1);
  } else {
    update.totalAdministrativos = FieldValue.increment(1);
  }

  await metaRef.set(update, { merge: true });
}

/** Tipos de evento permitidos para summary y meta. */
const SUMMARY_EVENT_TYPES = new Set([
  "excesos",
  "no_identificados",
  "contactos",
  "llave_sin_cargar",
  "conductor_inactivo",
]);

/**
 * Normaliza el tipo de evento para el summary.
 * Mapea tipos específicos a claves del summary (siempre uno de los 5 tipos).
 * @param {string} eventType - Tipo de evento original
 * @returns {string} Clave para el summary
 */
function normalizeEventTypeForSummary(eventType) {
  const typeMap = {
    exceso: "excesos",
    no_identificado: "no_identificados",
    contacto: "contactos",
    llave_no_registrada: "llave_sin_cargar",
    sin_llave: "llave_sin_cargar",
    conductor_inactivo: "conductor_inactivo",
  };
  return typeMap[eventType] || "no_identificados";
}

/**
 * Nombre del campo en meta del día para totales por tipo.
 * @param {string} summaryKey - excesos | no_identificados | contactos | llave_sin_cargar | conductor_inactivo
 * @returns {string}
 */
function getMetaFieldForType(summaryKey) {
  const fieldMap = {
    excesos: "totalExcesos",
    no_identificados: "totalNoIdentificados",
    contactos: "totalContactos",
    llave_sin_cargar: "totalLlaveSinCargar",
    conductor_inactivo: "totalConductorInactivo",
  };
  return fieldMap[summaryKey] || "totalNoIdentificados";
}

/** Pesos por tipo de evento para el score de riesgo (v2). */
const RISK_WEIGHTS_BY_TYPE = {
  excesos: 3,
  no_identificados: 2,
  contactos: 2,
  llave_sin_cargar: 1,
  conductor_inactivo: 1,
};

/** Pesos por severidad para el score de riesgo (v2). */
const RISK_WEIGHTS_BY_SEVERITY = {
  critico: 5,
  advertencia: 2,
  administrativo: 0,
  info: 0,
};

/**
 * Calcula el score de riesgo por vehículo para ordenar por criticidad.
 * Combina conteos por tipo y severidad de los eventos.
 * @param {object} summary - summary del documento (excesos, no_identificados, contactos, llave_sin_cargar, conductor_inactivo)
 * @param {Array<object>} events - Array de eventSummary con severity
 * @returns {number}
 */
function computeRiskScore(summary, events) {
  if (!summary && !events) return 0;
  let score = 0;
  if (summary && typeof summary === "object") {
    for (const [key, count] of Object.entries(summary)) {
      if (typeof count === "number" && RISK_WEIGHTS_BY_TYPE[key] != null) {
        score += RISK_WEIGHTS_BY_TYPE[key] * count;
      }
    }
  }
  const eventList = Array.isArray(events) ? events : [];
  for (const e of eventList) {
    const sev = e && e.severity ? e.severity : "administrativo";
    score += RISK_WEIGHTS_BY_SEVERITY[sev] != null ? RISK_WEIGHTS_BY_SEVERITY[sev] : 0;
  }
  return Math.max(0, score);
}

const ALLOWED_EVENT_TYPES = new Set([
  "exceso",
  "no_identificado",
  "contacto",
  "llave_no_registrada",
  "sin_llave",
  "conductor_inactivo",
]);

/**
 * Construye el objeto eventSummary a partir de un evento crudo (para uso en batch).
 * @param {object} event - Evento con plate, type, severity, eventId, etc.
 * @returns {object} eventSummary para el array events del documento dailyAlerts
 */
function buildEventSummary(event) {
  let eventType = event.type || "exceso";
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    eventType = "no_identificado";
  }
  const severity = event.severity || getSeverityByType(eventType);
  const speedVal = event.speed;
  const eventId =
    event.eventId ||
    generateDeterministicEventId(event.plate, event.eventTimestamp, event.rawLine || "");

  return {
    eventId,
    type: eventType,
    reason: event.reason || null,
    sourceEmailType: event.sourceEmailType || null,
    speed: typeof speedVal === "number" ? speedVal : null,
    hasSpeed: typeof speedVal === "number",
    eventTimestamp: event.eventTimestamp || "",
    location: event.location || "",
    severity,
    rawData: {
      brand: event.brand || null,
      model: event.model || null,
      timezone: event.timezone || null,
      eventCategory: event.eventCategory || null,
    },
  };
}

/**
 * Actualiza la meta del día con incrementos en lote (evita N writes por N eventos).
 * @param {string} dateKey - YYYY-MM-DD
 * @param {object} deltas - { totalEvents?, totalVehicles?, totalExcesos?, totalNoIdentificados?, totalContactos?, totalLlaveSinCargar?, totalConductorInactivo?, totalCriticos?, totalAdvertencias?, totalAdministrativos?, vehiclesWithCritical? }
 */
async function updateDailyMetaBatch(dateKey, deltas) {
  if (!deltas || typeof deltas !== "object") return;

  const db = getDb();
  const metaRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("meta")
    .doc("meta");

  const FieldValue = admin.firestore.FieldValue;
  const update = {
    dateKey,
    lastUpdatedAt: FieldValue.serverTimestamp(),
  };

  if (deltas.totalEvents != null && deltas.totalEvents > 0) {
    update.totalEvents = FieldValue.increment(deltas.totalEvents);
  }
  if (deltas.totalVehicles != null && deltas.totalVehicles > 0) {
    update.totalVehicles = FieldValue.increment(deltas.totalVehicles);
  }
  if (deltas.totalExcesos != null && deltas.totalExcesos > 0) {
    update.totalExcesos = FieldValue.increment(deltas.totalExcesos);
  }
  if (deltas.totalNoIdentificados != null && deltas.totalNoIdentificados > 0) {
    update.totalNoIdentificados = FieldValue.increment(deltas.totalNoIdentificados);
  }
  if (deltas.totalContactos != null && deltas.totalContactos > 0) {
    update.totalContactos = FieldValue.increment(deltas.totalContactos);
  }
  if (deltas.totalLlaveSinCargar != null && deltas.totalLlaveSinCargar > 0) {
    update.totalLlaveSinCargar = FieldValue.increment(deltas.totalLlaveSinCargar);
  }
  if (deltas.totalConductorInactivo != null && deltas.totalConductorInactivo > 0) {
    update.totalConductorInactivo = FieldValue.increment(deltas.totalConductorInactivo);
  }
  if (deltas.totalCriticos != null && deltas.totalCriticos > 0) {
    update.totalCriticos = FieldValue.increment(deltas.totalCriticos);
  }
  if (deltas.totalAdvertencias != null && deltas.totalAdvertencias > 0) {
    update.totalAdvertencias = FieldValue.increment(deltas.totalAdvertencias);
  }
  if (deltas.totalAdministrativos != null && deltas.totalAdministrativos > 0) {
    update.totalAdministrativos = FieldValue.increment(deltas.totalAdministrativos);
  }
  if (deltas.vehiclesWithCritical != null && deltas.vehiclesWithCritical > 0) {
    update.vehiclesWithCritical = FieldValue.increment(deltas.vehiclesWithCritical);
  }

  if (Object.keys(update).length <= 2) return; // solo dateKey y lastUpdatedAt
  await metaRef.set(update, { merge: true });
}

/**
 * Crea o actualiza el documento diario con todos los eventos del lote en una sola escritura.
 * Deduplica por eventId. No decrementa contadores.
 * @param {string} dateKey - YYYY-MM-DD
 * @param {string} plate - Patente normalizada
 * @param {object} vehicle - Datos del vehículo (plate, brand, model, responsables)
 * @param {Array<object>} eventSummaries - Array de eventSummary (buildEventSummary) ya deduplicado por eventId en este lote
 * @returns {{ isNewVehicle: boolean, metaDeltas: object }} para que el llamador agregue a updateDailyMetaBatch
 */
async function upsertDailyAlertBatch(dateKey, plate, vehicle, eventSummaries) {
  if (!eventSummaries || eventSummaries.length === 0) {
    return { isNewVehicle: false, metaDeltas: null };
  }

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

  const existingData = docSnap.exists ? docSnap.data() : null;
  const existingEvents = existingData?.events || [];
  const existingEventIds = new Set(existingEvents.map((e) => e.eventId));

  const newSummaries = eventSummaries.filter((es) => !existingEventIds.has(es.eventId));
  if (newSummaries.length === 0) {
    return { isNewVehicle: false, metaDeltas: null };
  }

  const mergedEvents = [...existingEvents];
  const summaryCounts = {
    excesos: existingData?.summary?.excesos ?? 0,
    no_identificados: existingData?.summary?.no_identificados ?? 0,
    contactos: existingData?.summary?.contactos ?? 0,
    llave_sin_cargar: existingData?.summary?.llave_sin_cargar ?? 0,
    conductor_inactivo: existingData?.summary?.conductor_inactivo ?? 0,
  };

  let totalCriticos = 0;
  let totalAdvertencias = 0;
  let totalAdministrativos = 0;
  let hasNewCritical = false;
  const hadCriticalBefore = existingEvents.some((e) => e.severity === "critico");

  for (const es of newSummaries) {
    mergedEvents.push(es);
    const key = normalizeEventTypeForSummary(es.type);
    summaryCounts[key] = (summaryCounts[key] || 0) + 1;
    if (es.severity === "critico") {
      totalCriticos++;
      hasNewCritical = true;
    } else if (es.severity === "advertencia") {
      totalAdvertencias++;
    } else {
      totalAdministrativos++;
    }
  }

  const riskScore = computeRiskScore(summaryCounts, mergedEvents);
  const isNewVehicle = !docSnap.exists;

  const docPayload = {
    plate: normalized,
    dateKey,
    brand: vehicle.brand || "",
    model: vehicle.model || "",
    responsables,
    alertSent: existingData?.alertSent ?? false,
    sentAt: existingData?.sentAt ?? null,
    lastEventAt: now,
    summary: summaryCounts,
    events: mergedEvents,
    riskScore,
  };

  if (isNewVehicle) {
    docPayload.createdAt = now;
    await vehiclesRef.set(docPayload);
  } else {
    await vehiclesRef.update(docPayload);
  }

  const metaDeltas = {
    totalEvents: newSummaries.length,
    totalExcesos: summaryCounts.excesos - (existingData?.summary?.excesos ?? 0),
    totalNoIdentificados: summaryCounts.no_identificados - (existingData?.summary?.no_identificados ?? 0),
    totalContactos: summaryCounts.contactos - (existingData?.summary?.contactos ?? 0),
    totalLlaveSinCargar: summaryCounts.llave_sin_cargar - (existingData?.summary?.llave_sin_cargar ?? 0),
    totalConductorInactivo: summaryCounts.conductor_inactivo - (existingData?.summary?.conductor_inactivo ?? 0),
    totalCriticos: totalCriticos,
    totalAdvertencias: totalAdvertencias,
    totalAdministrativos: totalAdministrativos,
    totalVehicles: isNewVehicle ? 1 : 0,
    vehiclesWithCritical: isNewVehicle && hasNewCritical ? 1 : !hadCriticalBefore && hasNewCritical ? 1 : 0,
  };

  return { isNewVehicle, metaDeltas };
}

/**
 * Crea o actualiza el documento diario en
 * /apps/emails/dailyAlerts/{YYYY-MM-DD}/vehicles/{plate}
 * Un solo evento (mantener para compatibilidad; preferir upsertDailyAlertBatch).
 * @param {string} dateKey - Fecha en formato YYYY-MM-DD
 * @param {string} plate - Patente normalizada
 * @param {object} vehicle - Datos del vehículo (plate, brand, model, responsables)
 * @param {object} event - Evento a agregar
 */
async function upsertDailyAlert(dateKey, plate, vehicle, event) {
  const eventSummary = buildEventSummary(event);
  const result = await upsertDailyAlertBatch(dateKey, plate, vehicle, [eventSummary]);
  if (result.metaDeltas) {
    await updateDailyMetaBatch(dateKey, result.metaDeltas);
  }
}

/**
 * Verifica si el email from pertenece a dominios permitidos.
 * @param {string} from - Campo from del email (ej: "alerta@pluspetrol.com")
 * @param {string} allowedDomains - Dominios separados por coma (ej: "pluspetrol.com,otro.com")
 * @returns {boolean}
 */
function isFromAllowedDomain(from, allowedDomains) {
  if (!from || !allowedDomains) return false;
  const email = String(from).trim().toLowerCase();
  const match = email.match(/@([^@\s]+)/);
  if (!match) return false;
  const domain = match[1];
  const domains = allowedDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return domains.some((d) => domain === d || domain.endsWith("." + d));
}

module.exports = {
  generateDeterministicEventId,
  saveVehicleEvents,
  upsertVehicle,
  getVehicle,
  createVehicleFromEvent,
  upsertDailyAlert,
  upsertDailyAlertBatch,
  updateDailyMetaBatch,
  buildEventSummary,
  formatDateKey,
  normalizePlate,
  isFromAllowedDomain,
  computeRiskScore,
};
