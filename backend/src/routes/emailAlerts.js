/**
 * Rutas para alertas diarias.
 * El backend NO envía emails. Solo expone pendientes y permite marcarlas como enviadas.
 * Un solo email por responsable por día, consolidando todas las patentes en un resumen.
 *
 * GET  /api/email/get-pending-daily-alerts → [{ responsableEmail, subject, body, alertIds }]
 * POST /api/email/mark-alert-sent → body: { alertIds: string[] }
 */

const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { formatDateKey, getVehicle, normalizePlate } = require("../services/vehicleEventService");
const { getDailyTotalsByType } = require("../services/dailyMetricsService");
const { logger } = require("../utils/logger");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const DAILY_ALERTS_REF = db
  .collection("apps")
  .doc("emails")
  .collection("dailyAlerts");

/**
 * Valida x-local-token. Retorna true si válido.
 */
function validateLocalToken(req) {
  const token = process.env.LOCAL_EMAIL_TOKEN;
  if (!token) return false;
  return req.headers["x-local-token"] === token;
}

/**
 * Parsea y valida ?date=YYYY-MM-DD. Retorna el string dateKey o null si es inválido.
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

/**
 * Obtiene TODAS las alertas pendientes (alertSent === false) de todas las fechas.
 * Recorre todas las subcolecciones de dailyAlerts.
 * 
 * IMPORTANTE: En Firestore, si un documento solo tiene subcolecciones pero no datos,
 * .get() no lo encuentra. Por eso usamos listCollections() para obtener las subcolecciones.
 */
async function getPendingAlerts() {
  const dateKeysSnap = await DAILY_ALERTS_REF.get();
  let dateKeys = dateKeysSnap.docs.map((doc) => doc.id);

  if (dateKeys.length === 0) {
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dateKeys.push(date.toISOString().slice(0, 10));
    }
  }

  const allAlerts = [];
  for (const dateKey of dateKeys) {
    try {
      const vehiclesSnap = await DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").get();
      for (const vehicleDoc of vehiclesSnap.docs) {
        const data = vehicleDoc.data();
        if (data.alertSent === false || data.alertSent === undefined || data.alertSent === null) {
          allAlerts.push({ id: vehicleDoc.id, dateKey, ...data });
        }
      }
    } catch {
      continue;
    }
  }
  return allAlerts;
}

/**
 * Obtiene el documento meta del día (apps/emails/dailyAlerts/{dateKey}/meta/meta).
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
 * Asunto del email consolidado por responsable/día.
 */
function buildConsolidatedSubject(dateKey) {
  return `🚨 Resumen diario de flota – ${dateKey}`;
}

/**
 * Formatea fecha/hora en formato argentino.
 */
function formatDateTimeArgentina(timestamp) {
  if (!timestamp) return "-";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
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
      return "Contacto sin identificación";
    default:
      return "Exceso de velocidad";
  }
}

/**
 * Mapea severidad a color para jerarquía visual en el email.
 */
function getSeverityColor(e) {
  switch (e.severity) {
    case "critico":
      return "#d32f2f"; // rojo
    case "advertencia":
      return "#f57c00"; // naranja
    case "administrativo":
      return "#1976d2"; // azul
    default:
      return "#1976d2"; // azul (info)
  }
}

/**
 * Escapa caracteres HTML para prevenir inyección.
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
 * Ordena documentos de vehículos por mayor criticidad (riskScore desc, luego patente).
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
 * Métricas por tipo desde meta del día (v2).
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
 * Encabezado global del email usando meta del día (resumen ejecutivo con métricas por tipo).
 */
function buildGlobalSummaryHeader(meta, dateKey) {
  const totalVehicles = meta ? (meta.totalVehicles ?? 0) : 0;
  const totalEvents = meta ? (meta.totalEvents ?? 0) : 0;
  const totalCriticos = meta ? (meta.totalCriticos ?? 0) : 0;
  const totalAdvertencias = meta ? (meta.totalAdvertencias ?? 0) : 0;
  const totalAdministrativos = meta ? (meta.totalAdministrativos ?? 0) : 0;
  const vehiclesWithCritical = meta ? (meta.vehiclesWithCritical ?? 0) : 0;
  const byType = getMetricsByTypeFromMeta(meta);

  const metricsByTypeHtml =
    byType.excesos > 0 || byType.no_identificados > 0 || byType.contactos > 0 ||
    byType.llave_sin_cargar > 0 || byType.conductor_inactivo > 0
      ? `<div style="font-size: 13px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #bbdefb;">
          <strong>Por tipo:</strong>
          ${byType.excesos > 0 ? ` Excesos de velocidad: ${byType.excesos}` : ""}
          ${byType.no_identificados > 0 ? ` | No identificados: ${byType.no_identificados}` : ""}
          ${byType.contactos > 0 ? ` | Contacto sin identificación: ${byType.contactos}` : ""}
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
      <strong>Vehículos con alertas:</strong> ${totalVehicles} &nbsp;|&nbsp;
      <strong>Total eventos:</strong> ${totalEvents}
      ${vehiclesWithCritical > 0 ? ` &nbsp;|&nbsp; <span style="color: #d32f2f; font-weight: bold;">Vehículos con críticos: ${vehiclesWithCritical}</span>` : ""}
    </div>
    <div style="font-size: 14px; margin-top: 8px;">
      ${totalCriticos > 0 ? `<span style="color: #d32f2f; font-weight: bold;">🔴 ${totalCriticos} críticos</span>` : ""}
      ${totalAdvertencias > 0 ? ` <span style="color: #f57c00; font-weight: bold;">🟠 ${totalAdvertencias} advertencias</span>` : ""}
      ${totalAdministrativos > 0 ? ` <span style="color: #1976d2; font-weight: bold;">ℹ️ ${totalAdministrativos} administrativos</span>` : ""}
    </div>
    ${metricsByTypeHtml}
  </div>`;
}

/**
 * Sección HTML por vehículo (patente, resumen por severidad, tabla de eventos).
 */
function buildVehicleSection(doc) {
  const { plate, brand, model, events, summary } = doc;
  if (!Array.isArray(events) || events.length === 0) {
    return `<section style="margin-bottom: 28px;"><h2 style="font-size: 18px; color: #333;">${escapeHtml(plate)}</h2><p>Sin eventos.</p></section>`;
  }

  const severityOrder = { critico: 0, advertencia: 1, administrativo: 2, info: 3 };
  const sortedEvents = events
    .filter((e) => e && e.eventTimestamp)
    .sort((a, b) => {
      const orderA = severityOrder[a.severity] ?? 3;
      const orderB = severityOrder[b.severity] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.eventTimestamp) - new Date(a.eventTimestamp);
    });
  const resumen = {
    critico: sortedEvents.filter((e) => e.severity === "critico").length,
    advertencia: sortedEvents.filter((e) => e.severity === "advertencia").length,
    administrativo: sortedEvents.filter((e) => e.severity === "administrativo").length,
  };
  const summaryByType = summary || {};

  const rowsHtml = sortedEvents
    .map((e) => {
      const color = getSeverityColor(e);
      let typeLabel =
        e.reason && typeof e.reason === "string" && e.reason.trim().length > 0
          ? e.reason + (e.speed != null && e.hasSpeed ? " - Exceso de velocidad" : "")
          : getTypeLabel(e);
      return `
    <tr>
      <td style="padding:8px; font-weight:bold; color:${color};">${escapeHtml(typeLabel)}</td>
      <td style="padding:8px;">${e.speed != null ? e.speed + " km/h" : "-"}</td>
      <td style="padding:8px;">${formatDateTimeArgentina(e.eventTimestamp)}</td>
      <td style="padding:8px;">${escapeHtml(e.location || "Sin ubicación")}</td>
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
  <section style="margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
    <h2 style="font-size: 18px; color: #333; margin: 0 0 8px 0;">🚗 ${escapeHtml(plate)}</h2>
    <p style="margin: 0 0 12px 0; font-size: 13px; color: #666;">${escapeHtml(brand || "")} ${escapeHtml(model || "")}</p>
    <div style="margin-bottom: 12px; font-size: 14px;">
      ${resumen.critico > 0 ? `<span style="color: #d32f2f; font-weight: bold;">🔴 ${resumen.critico} críticos</span>` : ""}
      ${resumen.advertencia > 0 ? ` <span style="color: #f57c00;">🟠 ${resumen.advertencia} advertencias</span>` : ""}
      ${resumen.administrativo > 0 ? ` <span style="color: #1976d2;">ℹ️ ${resumen.administrativo} administrativos</span>` : ""}
    </div>
    ${typeSummaryHtml}
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Tipo</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Velocidad</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Fecha/Hora</th>
          <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Ubicación</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>`;
}

/**
 * Cuerpo consolidado: encabezado global + sección por vehículo.
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
  <title>Resumen diario de flota – ${dateKey}</title>
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
 * Marca múltiples alertas como enviadas en batch (máx 500 por batch).
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
    const batch = db.batch();
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    for (const { dateKey, plate } of chunk) {
      const ref = DAILY_ALERTS_REF.doc(dateKey).collection("vehicles").doc(plate);
      batch.update(ref, {
        alertSent: true,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return toUpdate.length;
}

/**
 * GET /email/get-pending-daily-alerts
 *
 * Requiere: x-local-token.
 * Agrupa por responsable (email): un solo email por responsable por día.
 * Respuesta: [{ responsableEmail, subject, body, alertIds }].
 */
router.get("/email/get-pending-daily-alerts", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[GET-PENDING-ALERTS] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const docs = await getPendingAlerts();
    logger.info(`[GET-PENDING-ALERTS] Alertas pendientes (documentos): ${docs.length}`);

    if (docs.length === 0) {
      return res.status(200).json({ ok: true, alerts: [] });
    }

    // Enriquecer con responsables actuales desde vehicles si faltan
    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const plate = normalizePlate(doc.plate || doc.id);
        const fromDoc = Array.isArray(doc.responsables) ? doc.responsables : [];
        if (fromDoc.filter((e) => typeof e === "string" && e.includes("@")).length > 0) {
          return { ...doc, plate, responsables: fromDoc };
        }
        const vehicle = await getVehicle(plate);
        const responsables = Array.isArray(vehicle?.responsables)
          ? vehicle.responsables.filter((e) => typeof e === "string" && e.includes("@"))
          : [];
        return { ...doc, plate, responsables };
      })
    );

    const groups = groupAlertsByResponsable(enriched);
    logger.info(`[GET-PENDING-ALERTS] Agrupamiento por responsable: ${groups.length} responsable(s)`);
    groups.forEach((g, i) => {
      logger.info(`[GET-PENDING-ALERTS] Responsable ${i + 1}: ${g.responsableEmail}, patentes: ${g.docs.length}`);
    });

    const dateKeysNeeded = [...new Set(groups.map((g) => g.dateKey))];
    const metaByDate = new Map();
    for (const dateKey of dateKeysNeeded) {
      const meta = await getDailyMeta(dateKey);
      metaByDate.set(dateKey, meta);
    }

    const alerts = groups.map((group) => {
      const meta = metaByDate.get(group.dateKey) || null;
      const sortedDocs = sortVehiclesByCriticity(group.docs);
      const alertIds = sortedDocs.map((d) => `${group.dateKey}_${normalizePlate(d.plate || d.id)}`);
      return {
        responsableEmail: group.responsableEmail,
        subject: buildConsolidatedSubject(group.dateKey),
        body: buildConsolidatedBody(meta, sortedDocs, group.dateKey),
        alertIds,
      };
    });

    logger.info(`[GET-PENDING-ALERTS] Respuesta: ${alerts.length} email(s) consolidado(s)`);
    return res.status(200).json({ ok: true, alerts });
  } catch (err) {
    logger.error("[GET-PENDING-ALERTS] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
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
 * Compara total de eventos en meta del día con la suma de events en cada vehicle.
 * Útil para detectar posibles pérdidas o inconsistencias (v2).
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
 * Métricas del día (totales por tipo y por severidad) para dashboard o scripts (v2).
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
 * Sanity check: compara totalEvents en meta con suma de events por vehicle ese día.
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
 * Endpoint temporal de debug para verificar qué está pasando
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
