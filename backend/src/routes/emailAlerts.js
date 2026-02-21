/**
 * Rutas para alertas diarias.
 * El backend NO envía emails. Solo expone pendientes y permite marcarlas como enviadas.
 *
 * GET  /api/email/get-pending-daily-alerts
 * POST /api/email/mark-alert-sent
 */

const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { formatDateKey, getVehicle } = require("../services/vehicleEventService");
const { logger } = require("../utils/logger");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
 */
async function getPendingAlerts() {
  const dailyAlertsRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts");

  // Obtener todos los documentos de fechas (dateKeys)
  const dateKeysSnap = await dailyAlertsRef.get();
  
  const allAlerts = [];
  
  // Para cada fecha, obtener vehículos con alertSent == false
  for (const dateDoc of dateKeysSnap.docs) {
    const dateKey = dateDoc.id;
    const vehiclesSnap = await dateDoc.ref
      .collection("vehicles")
      .where("alertSent", "==", false)
      .get();
    
    // Agregar cada documento con su dateKey
    for (const vehicleDoc of vehiclesSnap.docs) {
      allAlerts.push({
        id: vehicleDoc.id,
        dateKey, // Incluir dateKey en el documento
        ...vehicleDoc.data()
      });
    }
  }
  
  return allAlerts;
}

/**
 * Construye el asunto del email.
 * Si hay eventos críticos, destaca cantidad en el asunto.
 */
function buildSubject(doc, dateKey) {
  const criticos = (doc.events || []).filter(e => e && e.severity === "critico").length;
  return criticos > 0
    ? `🚨 ${doc.plate} – ${criticos} evento(s) crítico(s) – ${dateKey}`
    : `🚗 ${doc.plate} – Alertas del ${dateKey}`;
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
    default:
      return "#1976d2"; // azul
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
 * Construye el cuerpo del email (HTML).
 * Soporta eventSummary con estructura fija: hasSpeed, speed, type.
 */
function buildBody(doc) {
  const { plate, brand, model, eventCount, events } = doc;

  if (!Array.isArray(events) || events.length === 0) {
    return `<p>No se encontraron eventos.</p>`;
  }

  // Ordenar eventos por fecha (más recientes primero)
  const sortedEvents = (events || [])
    .filter(e => e && e.eventTimestamp)
    .sort((a, b) => new Date(b.eventTimestamp) - new Date(a.eventTimestamp));

  // Calcular cantidad real de eventos (usar sortedEvents.length en lugar de eventCount)
  const actualEventCount = sortedEvents.length;

  // Resumen por severidad (críticos y advertencias)
  const resumen = {
    critico: sortedEvents.filter(e => e.severity === "critico").length,
    advertencia: sortedEvents.filter(e => e.severity === "advertencia").length,
  };

  // Filas HTML: tipo (con color), velocidad, fecha/hora, ubicación
  const rowsHtml = sortedEvents.map((e) => {
    const color = getSeverityColor(e);
    // Priorizar reason (texto original del proveedor) sobre type label
    const typeLabel = e.reason && typeof e.reason === "string" && e.reason.trim().length > 0
      ? e.reason
      : getTypeLabel(e);
    return `
    <tr>
      <td style="padding:8px; font-weight:bold; color:${color};">
        ${escapeHtml(typeLabel)}
      </td>
      <td style="padding:8px;">
        ${e.speed != null ? e.speed + " km/h" : "-"}
      </td>
      <td style="padding:8px;">
        ${formatDateTimeArgentina(e.eventTimestamp)}
      </td>
      <td style="padding:8px;">
        ${escapeHtml(e.location || "Sin ubicación")}
      </td>
    </tr>
  `;
  }).join("");

  const hasCritical = resumen.critico > 0;

  // Banner de críticos
  const criticalBanner = hasCritical
    ? `<div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
        <strong style="color: #d32f2f;">⚠️ Se detectaron eventos críticos.</strong>
      </div>`
    : "";

  // Resumen automático: críticos y advertencias
  const summarySection = `<div style="margin-bottom: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 4px;">
    <div style="font-size: 16px;">
      <span style="color: #d32f2f; font-weight: bold;">🔴 ${resumen.critico} críticos</span>
      <span style="margin-left: 20px; color: #f57c00; font-weight: bold;">🟠 ${resumen.advertencia} advertencias</span>
    </div>
  </div>`;
  
  // Fecha actual para footer
  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Alertas de vehículo ${plate}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  
  <!-- Cabecera profesional -->
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
    <h1 style="margin: 0; font-size: 24px; color: #333; font-weight: 600;">🚗 ${plate}</h1>
    <p style="margin: 8px 0 0 0; font-size: 16px; color: #666;">Alertas del día</p>
    <p style="margin: 4px 0 0 0; font-size: 14px; color: #999;">
      ${brand || "-"} ${model || "-"}
    </p>
  </div>
  
  <!-- Total de eventos destacado -->
  <div style="background-color: #e3f2fd; padding: 12px; border-radius: 4px; margin-bottom: 20px; text-align: center;">
    <strong style="font-size: 18px; color: #1976d2;">Total de eventos: ${actualEventCount}</strong>
  </div>
  
  ${criticalBanner}
  ${summarySection}
  
  <!-- Tabla con jerarquía visual por tipo y severidad -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Tipo</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Velocidad</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Fecha/Hora</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Ubicación</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  
  <!-- Footer -->
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
    <p style="margin: 0; color: #666; font-size: 12px;">
      Resumen automático generado el ${today}
    </p>
  </div>
  
</body>
</html>`.trim();
}

/**
 * Parsea alertId (formato: YYYY-MM-DD_PLATE) en { dateKey, plate }.
 */
function parseAlertId(alertId) {
  if (!alertId || typeof alertId !== "string") return null;
  const idx = alertId.indexOf("_");
  if (idx <= 0 || idx >= alertId.length - 1) return null;
  return {
    dateKey: alertId.slice(0, idx),
    plate: alertId.slice(idx + 1).trim(),
  };
}

/**
 * Marca una alerta como enviada.
 */
async function markAlertAsSent(dateKey, plate) {
  const docRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("vehicles")
    .doc(plate);

  await docRef.update({
    alertSent: true,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * GET /email/get-pending-daily-alerts
 *
 * Requiere: x-local-token
 * Devuelve TODAS las alertas con alertSent === false de todas las fechas.
 * Ignora completamente el query param date si se proporciona.
 */
router.get("/email/get-pending-daily-alerts", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[GET-PENDING-ALERTS] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    // Obtener TODAS las alertas pendientes de todas las fechas
    const docs = await getPendingAlerts();

    const alerts = await Promise.all(
      docs.map(async (doc) => {
        const plate = doc.plate || doc.id;
        const dateKey = doc.dateKey; // dateKey viene incluido en el documento
        const alertId = `${dateKey}_${plate}`;
        
        // Obtener responsables desde el vehículo
        const vehicle = await getVehicle(plate);
        const responsables = Array.isArray(vehicle?.responsables)
          ? vehicle.responsables.filter((e) => typeof e === "string" && e.includes("@"))
          : [];

        return {
          alertId,
          plate,
          responsables,
          subject: buildSubject(doc, dateKey),
          body: buildBody(doc),
        };
      })
    );

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
 * Requiere: x-local-token
 * Body: { alertId: string }
 */
router.post("/email/mark-alert-sent", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[MARK-ALERT-SENT] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const { alertId } = req.body || {};
    const parsed = parseAlertId(alertId);

    if (!parsed) {
      return res.status(400).json({
        error: "alertId inválido",
        expected: "YYYY-MM-DD_PLATE (ej: 2026-02-12_AF-999-EF)",
      });
    }

    await markAlertAsSent(parsed.dateKey, parsed.plate);

    return res.status(200).json({
      ok: true,
      alertId,
      dateKey: parsed.dateKey,
      plate: parsed.plate,
    });
  } catch (err) {
    logger.error("[MARK-ALERT-SENT] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

module.exports = router;
