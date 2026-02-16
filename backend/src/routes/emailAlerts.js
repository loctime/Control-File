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
const { formatDateKey } = require("../services/vehicleEventService");
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
  return `[ControlFile] Alertas vehículo ${doc.plate} - ${dateKey}`;
}

/**
 * Construye el cuerpo del email (HTML).
 * Soporta eventSummary con estructura fija: hasSpeed, speed, type.
 */
function buildBody(doc) {
  const { plate, brand, model, eventCount, events } = doc;
  const eventRows = (events || [])
    .map((e) => {
      const hasSpeed = e.hasSpeed === true;
      const speedCell = hasSpeed ? `${e.speed} km/h` : "-";
      const typeLabel =
        e.type === "no_identificado" ? "No identificado" : e.type === "contacto" ? "Contacto" : "Exceso";
      return `<tr><td>${speedCell}</td><td>${e.eventTimestamp || "-"}</td><td>${e.location || "-"}</td><td>${typeLabel}</td><td>${e.severity || "info"}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Alertas de vehículo ${plate}</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>🚗 Alertas diarias - ${plate}</h2>
  <p><strong>Vehículo:</strong> ${brand || "-"} ${model || "-"}</p>
  <p><strong>Total de eventos:</strong> ${eventCount || 0}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
    <thead>
      <tr style="background: #f0f0f0;">
        <th>Velocidad</th>
        <th>Fecha/Hora</th>
        <th>Ubicación</th>
        <th>Tipo</th>
        <th>Severidad</th>
      </tr>
    </thead>
    <tbody>${eventRows}</tbody>
  </table>
  <p style="margin-top: 20px; color: #666; font-size: 12px;">
    Este es un resumen automático del día ${new Date().toLocaleDateString("es-AR")}.
  </p>
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

    const alerts = docs.map((doc) => {
      const plate = doc.plate || doc.id;
      const alertId = `${dateKey}_${plate}`;
      const responsables = Array.isArray(doc.responsables)
        ? doc.responsables.filter((e) => typeof e === "string" && e.includes("@"))
        : [];

      return {
        alertId,
        plate,
        responsables,
        subject: buildSubject(doc, dateKey),
        body: buildBody(doc),
      };
    });

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
