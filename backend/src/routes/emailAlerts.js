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
 * Obtiene alertas pendientes (alertSent === false) para una fecha.
 */
async function getPendingAlerts(dateKey) {
  const snap = await db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("vehicles")
    .where("alertSent", "==", false)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Construye el asunto del email.
 */
function buildSubject(doc, dateKey) {
  return `🚗 ${doc.plate} – Alertas del ${dateKey}`;
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
 * Construye el cuerpo del email (HTML).
 * Soporta eventSummary con estructura fija: hasSpeed, speed, type.
 */
function buildBody(doc) {
  const { plate, brand, model, eventCount, events } = doc;
  
  // Ordenar eventos por fecha descendente (más recientes primero)
  const sortedEvents = (events || [])
    .filter(e => e && e.eventTimestamp)
    .sort((a, b) => {
      const dateA = new Date(a.eventTimestamp || 0);
      const dateB = new Date(b.eventTimestamp || 0);
      return dateB.getTime() - dateA.getTime();
    });
  
  // Calcular conteo por severidad
  const severityCount = {
    critico: 0,
    advertencia: 0, 
    info: 0
  };
  
  sortedEvents.forEach(e => {
    const severity = e.severity || "info";
    if (severityCount.hasOwnProperty(severity)) {
      severityCount[severity]++;
    }
  });
  
  // Determinar si hay críticos
  const hasCritical = severityCount.critico > 0;
  
  // Generar filas de eventos
  const eventRows = sortedEvents.map((e) => {
    const hasSpeed = e.hasSpeed === true;
    const speedValue = typeof e.speed === "number" ? e.speed : null;
    const speedCell = hasSpeed && speedValue !== null ? `${speedValue} km/h` : "-";
    
    // Estilo para velocidad alta
    const speedStyle = hasSpeed && speedValue >= 120 
      ? "color: #d32f2f; font-weight: bold;" 
      : "";
    
    // Estilo por severidad
    let severityStyle = "color: #666;";
    let typeLabel = e.type === "no_identificado" ? "No identificado" : 
                    e.type === "contacto" ? "Contacto" : "Exceso";
    
    if (e.severity === "critico") {
      severityStyle = "color: #d32f2f; font-weight: bold;";
    } else if (e.severity === "advertencia") {
      severityStyle = "color: #f57c00; font-weight: bold;";
    }
    
    return `<tr>
      <td style="${speedStyle}">${speedCell}</td>
      <td>${formatDateTimeArgentina(e.eventTimestamp)}</td>
      <td>${e.location || "-"}</td>
      <td>${typeLabel}</td>
      <td style="${severityStyle}">${e.severity || "info"}</td>
    </tr>`;
  }).join("");
  
  // Banner de críticos
  const criticalBanner = hasCritical 
    ? `<div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
        <strong style="color: #d32f2f;">⚠️ Se detectaron eventos críticos.</strong>
      </div>`
    : "";
  
  // Resumen visual
  const summarySection = `<div style="margin-bottom: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 4px;">
    <div style="font-size: 16px; margin-bottom: 8px;">
      <span style="color: #d32f2f; font-weight: bold;">🔴 Críticos: ${severityCount.critico}</span>
      <span style="margin-left: 20px; color: #f57c00; font-weight: bold;">🟠 Advertencias: ${severityCount.advertencia}</span>
      <span style="margin-left: 20px; color: #666;">⚪ Informativos: ${severityCount.info}</span>
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
    <strong style="font-size: 18px; color: #1976d2;">Total de eventos: ${eventCount || 0}</strong>
  </div>
  
  ${criticalBanner}
  ${summarySection}
  
  <!-- Tabla moderna -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Velocidad</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Fecha/Hora</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Ubicación</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Tipo</th>
        <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd;">Severidad</th>
      </tr>
    </thead>
    <tbody>
      ${eventRows}
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
 * Usa fecha actual (YYYY-MM-DD).
 * Devuelve alertas con alertSent === false.
 */
router.get("/email/get-pending-daily-alerts", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      logger.warn("[GET-PENDING-ALERTS] Intento no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const dateKey = formatDateKey(new Date());
    const docs = await getPendingAlerts(dateKey);

    const alerts = await Promise.all(
      docs.map(async (doc) => {
        const plate = doc.plate || doc.id;
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
