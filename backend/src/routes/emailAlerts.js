/**
 * Rutas para alertas diarias.
 * El backend NO env?a emails. Solo expone pendientes y permite marcarlas como enviadas.
 * Un solo email por responsable por d?a, consolidando todas las patentes en un resumen.
 *
 * GET  /api/email/get-pending-daily-alerts ? [{ responsableEmails, subject, body, alertIds }]
 * POST /api/email/mark-alert-sent ? body: { alertIds: string[] }
 */

const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { formatDateKey, getVehicle, normalizePlate } = require("../services/vehicleEventService");
const { getDailyTotalsByType } = require("../services/dailyMetricsService");
const { syncAccessUsers } = require("../modules/emailUsers/emailUsers.service");
const { logger } = require("../utils/logger");

function parseServiceAccount(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  try {
    return JSON.parse(trimmed.replace(/\\n/g, "\n"));
  } catch (_) {}
  return null;
}

if (!admin.apps.length) {
  const appData = parseServiceAccount(process.env.FB_ADMIN_APPDATA || "");

  if (appData) {
    admin.initializeApp({
      credential: admin.credential.cert(appData),
      projectId: process.env.FB_DATA_PROJECT_ID || appData.project_id,
    });
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    (process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  ) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    logger.warn("[emailAlerts] Firebase admin inicializado sin credenciales expl?citas");
    admin.initializeApp();
  }
}

const db = admin.firestore();

const DAILY_ALERTS_REF = db
  .collection("apps")
  .doc("emails")
  .collection("dailyAlerts");

/**
 * Valida x-local-token. Retorna true si v?lido.
 */
function validateLocalToken(req) {
  const token = process.env.LOCAL_EMAIL_TOKEN;
  if (!token) return false;
  return req.headers["x-local-token"] === token;
}

/**
 * Parsea y valida ?date=YYYY-MM-DD. Retorna el string dateKey o null si es inv?lido.
 */
function parseDateQuery(queryDate) {
  if (!queryDate || typeof queryDate !== "string") return null;
  const trimmed = queryDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return trimmed;
}

function getTodayKeyArgentina() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/**
 * Fecha de ayer en Argentina (YYYY-MM-DD). Se usa para buscar alertas diarias pendientes.
 */
function getYesterdayKeyArgentina() {
  const now = new Date();
  const argDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const [y, m, d] = argDateStr.split("-").map(Number);
  const argDate = new Date(y, m - 1, d);
  argDate.setDate(argDate.getDate() - 1);
  const yy = argDate.getFullYear();
  const mm = String(argDate.getMonth() + 1).padStart(2, "0");
  const dd = String(argDate.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Convierte un dateKey YYYY-MM-DD en un n?mero comparable (YYYYMMDD).
 * Devuelve NaN si el formato no es v?lido.
 */
function toDateKeyNumber(key) {
  if (!key || typeof key !== "string") return NaN;
  const trimmed = key.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return NaN;
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return y * 10000 + m * 100 + d;
}

function normalizeEmail(email) {
  if (email == null || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function normalizeEmailArray(values) {
  if (!Array.isArray(values)) return [];
  const set = new Set();
  for (const value of values) {
    const normalized = normalizeEmail(value);
    if (normalized) set.add(normalized);
  }
  return Array.from(set);
}

/**
 * Obtiene alertas pendientes de d?as anteriores a hoy (Argentina).
 * Una sola capa de filtrado: dateKey < todayKey y alertSent !== true.
 *
 * @param {string} todayKey - Fecha de hoy en Argentina (YYYY-MM-DD).
 * @returns {Promise<Array<{ id: string, dateKey: string, ... }>>} Documentos de veh?culos pendientes (nunca incluye el d?a actual).
 */
async function getPendingAlerts(todayKey) {
  const dateKeysSnap = await DAILY_ALERTS_REF.get();
  const allDateKeys = dateKeysSnap.docs.map((doc) => doc.id);

  const todayNum = toDateKeyNumber(todayKey);
  const pastDateKeys = allDateKeys.filter((dateKey) => {
    const num = toDateKeyNumber(dateKey);
    return Number.isFinite(num) && Number.isFinite(todayNum) && num < todayNum;
  });

  logger.info(
    "[GET-PENDING-ALERTS][DEBUG] todayKey=%s, todayNum=%s, allDateKeys=%j, pastDateKeys=%j",
    todayKey,
    String(todayNum),
    allDateKeys,
    pastDateKeys
  );

  const allAlerts = [];
  for (const dateKey of pastDateKeys) {
    try {
      const vehiclesSnap = await DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").get();
      logger.info(
        "[GET-PENDING-ALERTS][DEBUG] dateKey=%s, vehicles=%d",
        dateKey,
        vehiclesSnap.docs.length
      );

      for (const vehicleDoc of vehiclesSnap.docs) {
        const data = vehicleDoc.data();
        const isPending = data.alertSent !== true;

        logger.info(
          "[GET-PENDING-ALERTS][DEBUG] Evaluando doc dateKey=%s id=%s alertSent=%s isPending=%s",
          dateKey,
          vehicleDoc.id,
          String(data.alertSent),
          String(isPending)
        );

        if (isPending) {
          allAlerts.push({ id: vehicleDoc.id, dateKey, ...data });
        }
      }
    } catch (e) {
      logger.error(
        "[GET-PENDING-ALERTS][DEBUG] Error leyendo vehicles para dateKey=%s: %s",
        dateKey,
        e && e.message ? e.message : String(e)
      );
      continue;
    }
  }

  logger.info(
    "[GET-PENDING-ALERTS][DEBUG] Total alertas pendientes devueltas: %d",
    allAlerts.length
  );

  return allAlerts;
}

/**
 * Obtiene alertas pendientes solo para un dateKey (apps/emails/dailyAlerts/{dateKey}/vehicles).
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<Array<{ id: string, dateKey: string, ... }>>}
 */
async function getPendingAlertsForDateKey(dateKey) {
  const allAlerts = [];
  try {
    const vehiclesSnap = await DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").get();
    for (const vehicleDoc of vehiclesSnap.docs) {
      const data = vehicleDoc.data();
      if (data.alertSent !== true) {
        allAlerts.push({ id: vehicleDoc.id, dateKey, ...data });
      }
    }
  } catch (e) {
    logger.error(
      "[GET-PENDING-ALERTS][DEBUG] Error leyendo vehicles para dateKey=%s: %s",
      dateKey,
      e && e.message ? e.message : String(e)
    );
  }
  return allAlerts;
}

/**
 * Obtiene el documento meta del d?a (apps/emails/dailyAlerts/{dateKey}/meta/meta).
 * Retorna null si no existe; los contadores se tratan como 0.
 */
async function getDailyMeta(dateKey) {
  const metaSnap = await DAILY_ALERTS_REF.doc(dateKey).collection("meta").doc("meta").get();
  if (!metaSnap.exists) return null;
  return metaSnap.data();
}

/**
 * Agrupa alertas pendientes por responsable (email).
 * Una patente puede estar en varios responsables; dentro del mismo responsable no se duplica patente.
 * Retorna: Array<{ dateKey, responsableEmail, docs: vehicleDoc[] }>
 */
function groupAlertsByResponsable(pendingDocs) {
  const byKey = new Map();

  for (const doc of pendingDocs) {
    const plate = normalizePlate(doc.plate || doc.id);
    const dateKey = doc.dateKey;
    const responsables = Array.isArray(doc.responsables)
      ? doc.responsables.filter((e) => typeof e === "string" && e.includes("@"))
      : [];

    for (const email of responsables) {
      const key = `${dateKey}|${email.trim().toLowerCase()}`;
      if (!byKey.has(key)) {
        byKey.set(key, { dateKey, responsableEmail: email.trim(), plates: new Set(), docs: [] });
      }
      const group = byKey.get(key);
      if (!group.plates.has(plate)) {
        group.plates.add(plate);
        group.docs.push(doc);
      }
    }
  }

  return Array.from(byKey.values()).map((g) => ({ dateKey: g.dateKey, responsableEmail: g.responsableEmail, docs: g.docs }));
}

/**
 * Agrupa alertas pendientes por conjunto de responsables (mismo d?a + mismos emails).
 * Si m?ltiples veh?culos comparten exactamente el mismo conjunto de responsables, se genera un solo grupo consolidado.
 * Retorna: Array<{ dateKey, responsableEmails: string[], plates: Set<string>, docs: vehicleDoc[] }>
 */
function groupAlertsByResponsableSet(pendingDocs) {
  const byKey = new Map();

  for (const doc of pendingDocs) {
    const plate = normalizePlate(doc.plate || doc.id);
    const dateKey = doc.dateKey;
    const raw = Array.isArray(doc.responsables) ? doc.responsables : [];
    const responsableEmails = [...new Set(
      raw
        .filter((e) => typeof e === "string" && e.includes("@"))
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    )].sort();

    if (responsableEmails.length === 0) continue;

    const key = `${dateKey}|${responsableEmails.join(",")}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        dateKey,
        responsableEmails,
        plates: new Set(),
        docs: [],
      });
    }
    const group = byKey.get(key);
    group.plates.add(plate);
    group.docs.push(doc);
  }

  return Array.from(byKey.values()).map((g) => ({
    dateKey: g.dateKey,
    responsableEmails: g.responsableEmails,
    plates: g.plates,
    docs: g.docs,
  }));
}

/**
 * Asunto del email consolidado por responsable/d?a.
 */
function buildConsolidatedSubject(dateKey) {
  return `?? Resumen diario de flota ? ${dateKey}`;
}

/**
 * Formatea fecha/hora en formato argentino (DD/MM/YYYY HH:mm).
 * La hora mostrada debe coincidir EXACTAMENTE con la del email original.
 *
 * Para strings ISO con offset (ej. "2026-02-27T13:45:01-03:00") se extraen
 * fecha y hora del string sin usar Date, as? el servidor (UTC u otra TZ)
 * no altera la hora. Para Timestamp de Firestore o otros tipos se usa
 * timeZone "America/Argentina/Buenos_Aires".
 */
function formatDateTimeArgentina(timestamp) {
  if (!timestamp) return "-";
  try {
    // Firestore Timestamp: convertir a Date y formatear con TZ expl?cita
    if (timestamp && typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Argentina/Buenos_Aires",
      }).replace(/,/g, "");
    }

    const str = typeof timestamp === "string" ? timestamp.trim() : String(timestamp);
    // ISO con tiempo: "2026-02-27T13:45:01" o "2026-02-27T13:45:01-03:00" o "...Z"
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:[.]\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
    if (isoMatch) {
      const [, y, m, d, hh, mm] = isoMatch;
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }

    // Fallback: Date con timeZone Argentina
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    }).replace(/,/g, "");
  } catch {
    return "-";
  }
}

/**
 * Mapea type del evento a etiqueta legible para el email.
 */
function getTypeLabel(e) {
  switch (e.type) {
    case "sin_llave":
      return "SIN LLAVE";
    case "llave_no_registrada":
      return "Llave no registrada";
    case "conductor_inactivo":
      return "Conductor inactivo";
    case "no_identificado":
      return "No identificado";
    case "contacto":
      return "Contacto sin identificaci?n";
    default:
      return "Exceso de velocidad";
  }
}

/**
 * Color para eventos (todos cr?ticos): siempre rojo.
 */
function getSeverityColor(_e) {
  return "#d32f2f"; // rojo
}

/**
 * Escapa caracteres HTML para prevenir inyecci?n.
 */
function escapeHtml(text) {
  if (!text || typeof text !== "string") return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Ordena documentos de veh?culos por mayor criticidad (riskScore desc, luego patente).
 * Documentos sin riskScore se tratan como 0.
 */
function sortVehiclesByCriticity(docs) {
  if (!Array.isArray(docs) || docs.length <= 1) return docs;
  return [...docs].sort((a, b) => {
    const scoreA = typeof a.riskScore === "number" ? a.riskScore : 0;
    const scoreB = typeof b.riskScore === "number" ? b.riskScore : 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const plateA = (a.plate || a.id || "").toString();
    const plateB = (b.plate || b.id || "").toString();
    return plateA.localeCompare(plateB);
  });
}

/**
 * M?tricas por tipo desde meta del d?a (v2).
 * Devuelve objeto con totales por tipo para el resumen ejecutivo.
 */
function getMetricsByTypeFromMeta(meta) {
  if (!meta) {
    return {
      excesos: 0,
      no_identificados: 0,
      contactos: 0,
      llave_sin_cargar: 0,
      conductor_inactivo: 0,
    };
  }
  return {
    excesos: meta.totalExcesos ?? 0,
    no_identificados: meta.totalNoIdentificados ?? 0,
    contactos: meta.totalContactos ?? 0,
    llave_sin_cargar: meta.totalLlaveSinCargar ?? 0,
    conductor_inactivo: meta.totalConductorInactivo ?? 0,
  };
}

/**
 * Genera un objeto "meta" a partir solo de los documentos de veh?culos dados.
 * Usado para resumen personalizado por destinatario (solo sus patentes).
 * Recalcula: totalVehicles, totalEvents, vehiclesWithCritical, totales por tipo.
 */
function buildMetaFromVehicleDocs(vehicleDocs) {
  if (!Array.isArray(vehicleDocs) || vehicleDocs.length === 0) {
    return {
      totalVehicles: 0,
      totalEvents: 0,
      vehiclesWithCritical: 0,
      totalExcesos: 0,
      totalNoIdentificados: 0,
      totalContactos: 0,
      totalLlaveSinCargar: 0,
      totalConductorInactivo: 0,
    };
  }
  let totalEvents = 0;
  let vehiclesWithCritical = 0;
  const byType = {
    excesos: 0,
    no_identificados: 0,
    contactos: 0,
    llave_sin_cargar: 0,
    conductor_inactivo: 0,
  };
  for (const doc of vehicleDocs) {
    const events = Array.isArray(doc.events) ? doc.events : [];
    const n = events.length;
    totalEvents += n;
    if (n > 0) vehiclesWithCritical += 1;
    const s = doc.summary || {};
    byType.excesos += s.excesos ?? 0;
    byType.no_identificados += s.no_identificados ?? 0;
    byType.contactos += s.contactos ?? 0;
    byType.llave_sin_cargar += s.llave_sin_cargar ?? 0;
    byType.conductor_inactivo += s.conductor_inactivo ?? 0;
  }
  return {
    totalVehicles: vehicleDocs.length,
    totalEvents,
    vehiclesWithCritical,
    totalExcesos: byType.excesos,
    totalNoIdentificados: byType.no_identificados,
    totalContactos: byType.contactos,
    totalLlaveSinCargar: byType.llave_sin_cargar,
    totalConductorInactivo: byType.conductor_inactivo,
  };
}

/**
 * Encabezado global del email usando meta del d?a (resumen ejecutivo con m?tricas por tipo).
 */
function buildGlobalSummaryHeader(meta, dateKey) {
  const totalVehicles = meta ? (meta.totalVehicles ?? 0) : 0;
  const totalEvents = meta ? (meta.totalEvents ?? 0) : 0;
  const vehiclesWithCritical = meta ? (meta.vehiclesWithCritical ?? 0) : 0;
  const byType = getMetricsByTypeFromMeta(meta);

  const metricsByTypeHtml =
    byType.excesos > 0 || byType.no_identificados > 0 || byType.contactos > 0 ||
    byType.llave_sin_cargar > 0 || byType.conductor_inactivo > 0
      ? `<div style="font-size: 13px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #bbdefb;">
          <strong>Por tipo:</strong>
          ${byType.excesos > 0 ? ` Excesos de velocidad: ${byType.excesos}` : ""}
          ${byType.no_identificados > 0 ? ` | No identificados: ${byType.no_identificados}` : ""}
          ${byType.contactos > 0 ? ` | Contacto sin identificaci?n: ${byType.contactos}` : ""}
          ${byType.llave_sin_cargar > 0 ? ` | Llave sin cargar: ${byType.llave_sin_cargar}` : ""}
          ${byType.conductor_inactivo > 0 ? ` | Conductor inactivo: ${byType.conductor_inactivo}` : ""}
        </div>`
      : "";

  return `
  <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #eee;">
    <h1 style="margin: 0; font-size: 22px; color: #333; font-weight: 600;">Resumen diario de flota</h1>
    <p style="margin: 8px 0 0 0; font-size: 16px; color: #666;">${dateKey}</p>
  </div>
  <div style="background-color: #e3f2fd; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
    <div style="font-size: 14px; line-height: 1.8;">
      <strong>Veh?culos con alertas:</strong> ${totalVehicles} &nbsp;|&nbsp;
      <strong>Total eventos:</strong> ${totalEvents}
      ${vehiclesWithCritical > 0 ? ` &nbsp;|&nbsp; <span style="color: #d32f2f; font-weight: bold;">Veh?culos con eventos: ${vehiclesWithCritical}</span>` : ""}
    </div>
    <div style="font-size: 14px; margin-top: 8px;">
      ${totalEvents > 0 ? `<span style="color: #d32f2f; font-weight: bold;">?? ${totalEvents} eventos</span>` : ""}
    </div>
    ${metricsByTypeHtml}
  </div>`;
}

/**
 * Secci?n HTML por veh?culo (patente, resumen por severidad, tabla de eventos).
 */
function buildVehicleSection(doc) {
  const { plate, brand, model, events, summary } = doc;
  if (!Array.isArray(events) || events.length === 0) {
    return `<section style="margin-bottom: 28px;"><h2 style="font-size: 18px; color: #333;">${escapeHtml(plate)}</h2><p>Sin eventos.</p></section>`;
  }

  const sortedEvents = events
    .filter((e) => e && e.eventTimestamp)
    .sort((a, b) => new Date(b.eventTimestamp) - new Date(a.eventTimestamp));
  const totalEventos = sortedEvents.length;
  const summaryByType = summary || {};

  const rowsHtml = sortedEvents
    .map((e) => {
      const color = getSeverityColor(e);
      let typeLabel;
      const hasReason = e.reason && typeof e.reason === "string" && e.reason.trim().length > 0;
      const hasDriver = e.driverName && typeof e.driverName === "string" && e.driverName.trim().length > 0;
      if (hasReason || hasDriver) {
        const parts = [];
        if (hasReason) parts.push(e.reason.trim());
        if (hasDriver) parts.push(e.driverName.trim());
        const prefix = parts.join(" - ");
        typeLabel = prefix + (e.speed != null && e.hasSpeed ? " - Exceso de velocidad" : "");
      } else {
        typeLabel = getTypeLabel(e);
      }
      return `
    <tr>
      <td style="padding:8px; font-weight:bold; color:${color};">${escapeHtml(typeLabel)}</td>
      <td style="padding:8px;">${e.speed != null ? e.speed + " km/h" : "-"}</td>
      <td style="padding:8px;">${formatDateTimeArgentina(e.eventTimestamp)}</td>
      <td style="padding:8px;">${escapeHtml(e.locationRaw || e.location || "Sin ubicaci?n")}</td>
    </tr>`;
    })
    .join("");

  const typeSummaryHtml =
    Object.keys(summaryByType).length > 0
      ? `<div style="font-size: 12px; margin-bottom: 8px; color: #555;">
          ${summaryByType.excesos > 0 ? `Excesos: ${summaryByType.excesos}` : ""}
          ${summaryByType.no_identificados > 0 ? ` | No identificados: ${summaryByType.no_identificados}` : ""}
          ${summaryByType.contactos > 0 ? ` | Contactos: ${summaryByType.contactos}` : ""}
          ${summaryByType.llave_sin_cargar > 0 ? ` | Llave sin cargar: ${summaryByType.llave_sin_cargar}` : ""}
          ${summaryByType.conductor_inactivo > 0 ? ` | Conductor inactivo: ${summaryByType.conductor_inactivo}` : ""}
        </div>`
      : "";

  return `
  <section style="margin-bottom: 28px;">
    <div style="border-top:1px solid #ccc; margin:20px 0;"></div>
    <h2 style="font-size: 16px; color: #333; margin: 0 0 8px 0;">
      ?? ${escapeHtml(plate)} - ${escapeHtml(brand || "")} ${escapeHtml(model || "")}
      ${totalEventos > 0 ? `<span style="color: #d32f2f; font-weight: bold;"> ?? ${totalEventos} ${totalEventos === 1 ? "evento" : "eventos"}</span>` : ""}
    </h2>
    ${typeSummaryHtml}
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Tipo</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Velocidad</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Fecha/Hora</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Ubicaci?n</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="border-top:1px solid #ccc; margin:20px 0;"></div>
  </section>`;
}

/**
 * Cuerpo consolidado: encabezado global + secci?n por veh?culo.
 */
function buildConsolidatedBody(meta, vehicleDocs, dateKey) {
  const sections = vehicleDocs.map((doc) => buildVehicleSection(doc)).join("");
  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Resumen diario de flota ? ${dateKey}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  ${buildGlobalSummaryHeader(meta, dateKey)}
  ${sections}
  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; text-align: center;">
    <p style="margin: 0; color: #666; font-size: 12px;">Resumen generado el ${today}</p>
  </div>
</body>
</html>`.trim();
}

/**
 * Cuerpo del email general por grupos operativos (todas las operaciones en un solo HTML).
 * Recibe el array groups de groupAlertsByResponsableSet; por cada grupo ordena por criticidad,
 * calcula meta con buildMetaFromVehicleDocs y usa buildVehicleSection por veh?culo.
 */
function buildGeneralGroupsBody(groups, dateKey) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return `
  <html>
    <body style="font-family: Arial; padding: 20px;">
      <h2>No hay alertas pendientes.</h2>
    </body>
  </html>
    `.trim();
  }

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const sections = groups
    .map((group) => {
      const sortedDocs = sortVehiclesByCriticity(group.docs);
      const meta = buildMetaFromVehicleDocs(sortedDocs);
      const operationName = (sortedDocs[0]?.operationName || sortedDocs[0]?.operacion || "Operaci?n no asignada").toUpperCase();
      const responsablesText = (group.responsableEmails || []).join(", ");

      return `
  <div style="margin-top: 35px; border-top: 3px solid #000; padding-top: 12px;">
    <h2 style="margin: 0; font-size: 18px;">
      ?? OPERACI?N ${escapeHtml(operationName)}
    </h2>
    <div style="font-size: 13px; color: #555; margin: 6px 0 12px 0;">
      Responsables: ${escapeHtml(responsablesText)}<br>
      Veh?culos con eventos: ${meta.totalVehicles} |
      Total eventos: ${meta.totalEvents}
    </div>
  </div>

  ${sortedDocs.map((doc) => buildVehicleSection(doc)).join("")}
      `.trim();
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Resumen General de Operaciones ? ${dateKey}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background: #ffffff;">

    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #eee;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">
        ?? Resumen General de Operaciones
      </h1>
      <p style="margin: 6px 0 0 0; color: #666; font-size: 14px;">
        ${dateKey}
      </p>
    </div>

    ${sections}

    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #666;">
        Resumen generado el ${today}
      </p>
    </div>

  </body>
</html>
  `.trim();
}

/**
 * Parsea alertId (formato: YYYY-MM-DD_PLATE) en { dateKey, plate }.
 * Normaliza la patente para garantizar consistencia.
 */
function parseAlertId(alertId) {
  if (!alertId || typeof alertId !== "string") return null;
  const idx = alertId.indexOf("_");
  if (idx <= 0 || idx >= alertId.length - 1) return null;
  const rawPlate = alertId.slice(idx + 1).trim();
  return {
    dateKey: alertId.slice(0, idx),
    plate: normalizePlate(rawPlate), // Normalizar patente
  };
}

/**
 * Marca una alerta como enviada (un documento vehicle).
 */
async function markAlertAsSent(dateKey, plate) {
  const normalizedPlate = normalizePlate(plate);
  const docRef = DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").doc(normalizedPlate);
  await docRef.update({
    alertSent: true,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Marca m?ltiples alertas como enviadas en batch (m?x 500 por batch).
 */
async function markAlertsAsSentBatch(alertIds) {
  const parsed = alertIds
    .map((id) => parseAlertId(id))
    .filter(Boolean);
  const uniqueKeys = new Map();
  for (const { dateKey, plate } of parsed) {
    uniqueKeys.set(`${dateKey}|${plate}`, { dateKey, plate });
  }
  const toUpdate = Array.from(uniqueKeys.values());
  const BATCH_SIZE = 500;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const docRefs = chunk.map(({ dateKey, plate }) =>
      DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").doc(plate)
    );
    const docSnaps = await db.getAll(...docRefs);

    const batch = db.batch();

    for (let j = 0; j < chunk.length; j += 1) {
      const { dateKey, plate } = chunk[j];
      const vehicleSnap = docSnaps[j];
      const ref = DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").doc(plate);
      batch.update(ref, {
        alertSent: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const vehicleData = vehicleSnap.exists ? vehicleSnap.data() || {} : {};
      const responsables = normalizeEmailArray(
        Array.isArray(vehicleData.responsablesNormalized) && vehicleData.responsablesNormalized.length > 0
          ? vehicleData.responsablesNormalized
          : vehicleData.responsables
      );
      const encodedAlertId = encodeURIComponent(`${dateKey}_${plate}`);

      for (const email of responsables) {
        const indexRef = db
          .collection("apps")
          .doc("emails")
          .collection("responsables")
          .doc(encodeURIComponent(email))
          .collection("alerts")
          .doc(encodedAlertId);

        batch.set(
          indexRef,
          {
            alertSent: true,
          },
          { merge: true }
        );
      }
    }

    await batch.commit();
  }
  return toUpdate.length;
}

/**
 * GET /email/get-pending-daily-alerts
 *
 * Requiere: x-local-token.
 * Agrupa por conjunto de responsables (mismo d?a + mismos emails): un solo email por grupo consolidado.
 * Respuesta: [{ responsableEmails, subject, body, alertIds }].
 */
router.get("/email/get-pending-daily-alerts", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[GET-PENDING-ALERTS] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const dateKey = getYesterdayKeyArgentina();
    logger.info("[GET-PENDING-ALERTS] searching alerts for dateKey:", dateKey);

    const docs = await getPendingAlertsForDateKey(dateKey);

    logger.info(`[GET-PENDING-ALERTS] Alertas pendientes (documentos): ${docs.length}`);

    if (docs.length === 0) {
      const generalBody = buildGeneralGroupsBody([], dateKey);
      return res.status(200).json({
        ok: true,
        alerts: [],
        general: {
          subject: `?? Resumen general de operaciones ? ${dateKey}`,
          body: generalBody,
        },
      });
    }

    // Enriquecer siempre con responsables actuales desde vehicles
    const enrichedResults = await Promise.allSettled(
      docs.map(async (doc) => {
        const plate = normalizePlate(doc.plate || doc.id);
        let vehicle = null;

        try {
          vehicle = await getVehicle(plate);
        } catch (err) {
          logger.warn(
            `[GET-PENDING-ALERTS] No se pudo obtener vehicle ${plate}:`,
            err && err.message ? err.message : String(err)
          );
        }

        const responsables = Array.isArray(vehicle?.responsables)
          ? vehicle.responsables.filter((e) => typeof e === "string" && e.includes("@"))
          : Array.isArray(doc.responsables)
            ? doc.responsables.filter((e) => typeof e === "string" && e.includes("@"))
            : [];
        const operationName = vehicle?.operationName || vehicle?.operacion || doc.operationName || doc.operacion || null;
        return { ...doc, plate, responsables, operationName, operacion: operationName };
      })
    );

    const enriched = enrichedResults
      .map((result, idx) => {
        if (result.status === "fulfilled") return result.value;

        const failedDoc = docs[idx] || {};
        const plate = normalizePlate(failedDoc.plate || failedDoc.id);
        logger.warn(
          `[GET-PENDING-ALERTS] Enriquecimiento inv?lido para ${plate}:`,
          result.reason && result.reason.message ? result.reason.message : String(result.reason)
        );

        const fallbackResponsables = Array.isArray(failedDoc.responsables)
          ? failedDoc.responsables.filter((e) => typeof e === "string" && e.includes("@"))
          : [];

        return {
          ...failedDoc,
          plate,
          responsables: fallbackResponsables,
          operationName: failedDoc.operationName || failedDoc.operacion || null,
          operacion: failedDoc.operationName || failedDoc.operacion || null,
        };
      })
      .filter(Boolean);

    const groups = groupAlertsByResponsableSet(enriched);
    logger.info(`[GET-PENDING-ALERTS] Agrupamiento por conjunto de responsables: ${groups.length} grupo(s)`);
    groups.forEach((g, i) => {
      logger.info(`[GET-PENDING-ALERTS] Grupo ${i + 1}: responsables [${g.responsableEmails.join(", ")}], patentes: ${g.docs.length}`);
    });

    const alerts = groups.map((group) => {
      const sortedDocs = sortVehiclesByCriticity(group.docs);
      const metaForRecipient = buildMetaFromVehicleDocs(sortedDocs);
      const alertIds = sortedDocs.map((d) => `${group.dateKey}_${normalizePlate(d.plate || d.id)}`);
      const responsableEmails = group.responsableEmails;
      return {
        responsableEmails,
        // Backward compatibility for existing PowerShell scripts.
        responsableEmail: responsableEmails.length > 0 ? responsableEmails[0] : null,
        subject: buildConsolidatedSubject(group.dateKey),
        body: buildConsolidatedBody(metaForRecipient, sortedDocs, group.dateKey),
        alertIds,
      };
    });

    const dateKeyForGeneral = groups.length > 0 ? groups[0].dateKey : dateKey;
    const generalBody = buildGeneralGroupsBody(groups, dateKeyForGeneral);

    logger.info(`[GET-PENDING-ALERTS] Respuesta: ${alerts.length} email(s) consolidado(s)`);
    return res.status(200).json({
      ok: true,
      general: {
        subject: `?? Resumen general de operaciones ? ${dateKeyForGeneral}`,
        body: generalBody,
      },
      alerts,
    });
  } catch (err) {
    logger.error("[GET-PENDING-ALERTS] Error no controlado", {
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined,
    });
    const todayKey = getTodayKeyArgentina();
    const generalBody = buildGeneralGroupsBody([], todayKey);
    return res.status(200).json({
      ok: true,
      alerts: [],
      general: {
        subject: `Resumen general de operaciones - ${todayKey}`,
        body: generalBody,
      },
    });
  }
});

/**
 * POST /email/mark-alert-sent
 *
 * Requiere: x-local-token.
 * Body: { alertIds: string[] } o { alertId: string } (compatibilidad).
 */
router.post("/email/mark-alert-sent", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[MARK-ALERT-SENT] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const body = req.body || {};
    let ids = Array.isArray(body.alertIds) ? body.alertIds : [];
    if (ids.length === 0 && body.alertId) {
      ids = [String(body.alertId)];
    }

    if (ids.length === 0) {
      return res.status(400).json({
        error: "Se requiere alertIds (array) o alertId (string)",
        expected: "alertIds: ['YYYY-MM-DD_PLATE', ...] o alertId: 'YYYY-MM-DD_PLATE'",
      });
    }

    const count = await markAlertsAsSentBatch(ids);
    logger.info(`[MARK-ALERT-SENT] Marcadas ${count} alerta(s) como enviadas`);
    return res.status(200).json({
      ok: true,
      alertIds: ids,
      marked: count,
    });
  } catch (err) {
    logger.error("[MARK-ALERT-SENT] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * POST /email/sync-access-users
 *
 * Sincroniza usuarios de acceso (mismo efecto que /api/admin/sync-access-users).
 * Requiere: x-local-token. Para uso desde scripts/cron (ej. enviar-email.ps1).
 */
router.post("/email/sync-access-users", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[SYNC-ACCESS-USERS] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }
    const result = await syncAccessUsers();
    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (err) {
    logger.error("[SYNC-ACCESS-USERS] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * Compara total de eventos en meta del d?a con la suma de events en cada vehicle.
 * ?til para detectar posibles p?rdidas o inconsistencias (v2).
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {{ ok: boolean, totalInMeta: number, totalInAlerts: number, diff: number }}
 */
async function getDailyConsistency(dateKey) {
  const meta = await getDailyMeta(dateKey);
  const totalInMeta = meta ? (meta.totalEvents ?? 0) : 0;

  const vehiclesSnap = await DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").get();
  let totalInAlerts = 0;
  for (const doc of vehiclesSnap.docs) {
    const data = doc.data();
    const events = Array.isArray(data.events) ? data.events : [];
    totalInAlerts += events.length;
  }

  const diff = totalInMeta - totalInAlerts;
  return {
    ok: diff === 0,
    totalInMeta,
    totalInAlerts,
    diff,
  };
}

/**
 * GET /email/daily-metrics?date=YYYY-MM-DD
 * M?tricas del d?a (totales por tipo y por severidad) para dashboard o scripts (v2).
 */
router.get("/email/daily-metrics", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      return res.status(401).json({ error: "no autorizado" });
    }
    const dateKey = parseDateQuery(req.query.date);
    if (!dateKey) {
      return res.status(400).json({ error: "Query date requerido en formato YYYY-MM-DD" });
    }
    const metrics = await getDailyTotalsByType(dateKey);
    return res.status(200).json({ ok: true, dateKey, metrics });
  } catch (err) {
    logger.error("[DAILY-METRICS] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * GET /email/daily-consistency?date=YYYY-MM-DD
 * Sanity check: compara totalEvents en meta con suma de events por vehicle ese d?a.
 */
router.get("/email/daily-consistency", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      return res.status(401).json({ error: "no autorizado" });
    }
    const dateKey = parseDateQuery(req.query.date);
    if (!dateKey) {
      return res.status(400).json({ error: "Query date requerido en formato YYYY-MM-DD" });
    }
    const result = await getDailyConsistency(dateKey);
    return res.status(200).json({ ok: true, dateKey, ...result });
  } catch (err) {
    logger.error("[DAILY-CONSISTENCY] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * GET /email/debug-pending-alerts
 * Endpoint temporal de debug para verificar qu? est? pasando
 */
router.get("/email/debug-pending-alerts", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      return res.status(401).json({ error: "no autorizado" });
    }

    const dateKeysSnap = await DAILY_ALERTS_REF.get();
    const debugInfo = {
      totalDateKeys: dateKeysSnap.docs.length,
      dateKeys: dateKeysSnap.docs.map((d) => d.id),
      vehiclesByDate: {},
    };

    for (const dateDoc of dateKeysSnap.docs) {
      const dateKey = dateDoc.id;
      const vehiclesSnap = await dateDoc.ref.collection("vehicles").get();
      
      const vehicles = vehiclesSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          plate: data.plate || doc.id,
          alertSent: data.alertSent,
          alertSentType: typeof data.alertSent,
          eventCount: data.eventCount || 0,
          eventsLength: Array.isArray(data.events) ? data.events.length : 0
        };
      });
      
      debugInfo.vehiclesByDate[dateKey] = {
        total: vehiclesSnap.docs.length,
        pending: vehicles.filter(v => v.alertSent === false || v.alertSent === undefined || v.alertSent === null).length,
        vehicles: vehicles
      };
    }

    return res.status(200).json({ ok: true, debug: debugInfo });
  } catch (err) {
    logger.error("[DEBUG-PENDING-ALERTS] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: err.message
    });
  }
});

module.exports = router;

