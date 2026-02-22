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
const { formatDateKey, getVehicle, normalizePlate } = require("../services/vehicleEventService");
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
 * 
 * IMPORTANTE: En Firestore, si un documento solo tiene subcolecciones pero no datos,
 * .get() no lo encuentra. Por eso usamos listCollections() para obtener las subcolecciones.
 */
async function getPendingAlerts() {
  const dailyAlertsRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts");
  
  // Intentar obtener documentos de fecha directamente
  const dateKeysSnap = await dailyAlertsRef.get();
  let dateKeys = dateKeysSnap.docs.map(doc => doc.id);
  
  // Si no hay documentos pero sabemos que hay datos, buscar en fechas recientes
  // (últimos 60 días para cubrir cualquier fecha posible)
  if (dateKeys.length === 0) {
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      dateKeys.push(dateKey);
    }
  }
  
  const allAlerts = [];
  
  // Para cada fecha, obtener vehículos y filtrar los que tienen alertSent == false
  for (const dateKey of dateKeys) {
    try {
      const vehiclesRef = dailyAlertsRef.doc(dateKey).collection("vehicles");
      const vehiclesSnap = await vehiclesRef.get();
      
      // Si hay vehículos en esta fecha, procesarlos
      if (vehiclesSnap.docs.length > 0) {
        for (const vehicleDoc of vehiclesSnap.docs) {
          const data = vehicleDoc.data();
          const alertSent = data.alertSent;
          
          // Si alertSent es false o no existe, incluir el documento
          if (alertSent === false || alertSent === undefined || alertSent === null) {
            allAlerts.push({
              id: vehicleDoc.id,
              dateKey,
              ...data
            });
          }
        }
      }
    } catch (err) {
      // Si la fecha no existe, continuar con la siguiente
      continue;
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
 * Construye el cuerpo del email (HTML).
 * Soporta eventSummary con estructura fija: hasSpeed, speed, type.
 * Ahora también muestra resumen por tipo de evento usando el campo summary.
 */
function buildBody(doc) {
  const { plate, brand, model, eventCount, events, summary } = doc;

  if (!Array.isArray(events) || events.length === 0) {
    return `<p>No se encontraron eventos.</p>`;
  }

  // Ordenar eventos por fecha (más recientes primero)
  const sortedEvents = (events || [])
    .filter(e => e && e.eventTimestamp)
    .sort((a, b) => new Date(b.eventTimestamp) - new Date(a.eventTimestamp));

  // Calcular cantidad real de eventos (usar sortedEvents.length en lugar de eventCount)
  const actualEventCount = sortedEvents.length;

  // Resumen por severidad (críticos, advertencias y administrativos)
  const resumen = {
    critico: sortedEvents.filter(e => e.severity === "critico").length,
    advertencia: sortedEvents.filter(e => e.severity === "advertencia").length,
    administrativo: sortedEvents.filter(e => e.severity === "administrativo").length,
  };

  // Resumen por tipo de evento (si existe el campo summary)
  const summaryByType = summary || {};

  // Filas HTML: tipo (con color), velocidad, fecha/hora, ubicación
  const rowsHtml = sortedEvents.map((e) => {
    const color = getSeverityColor(e);
    
    // Construir typeLabel: si hay reason Y speed, mostrar ambos
    let typeLabel = "";
    if (e.reason && typeof e.reason === "string" && e.reason.trim().length > 0) {
      typeLabel = e.reason;
      // Si además tiene velocidad, indicar que también es exceso
      if (e.speed != null && e.hasSpeed) {
        typeLabel += ` - Exceso de velocidad`;
      }
    } else {
      typeLabel = getTypeLabel(e);
    }
    
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

  // Resumen por tipo de evento (si existe summary)
  const typeSummaryHtml = summaryByType && Object.keys(summaryByType).length > 0
    ? `<div style="margin-bottom: 20px; padding: 16px; background-color: #f0f4f8; border-radius: 4px; border-left: 4px solid #1976d2;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #333;">Resumen por tipo:</div>
        <div style="font-size: 13px; line-height: 1.8;">
          ${summaryByType.excesos > 0 ? `<span style="margin-right: 16px;">🚨 Excesos: <strong>${summaryByType.excesos}</strong></span>` : ""}
          ${summaryByType.no_identificados > 0 ? `<span style="margin-right: 16px;">❓ No identificados: <strong>${summaryByType.no_identificados}</strong></span>` : ""}
          ${summaryByType.contactos > 0 ? `<span style="margin-right: 16px;">📞 Contactos: <strong>${summaryByType.contactos}</strong></span>` : ""}
          ${summaryByType.llave_sin_cargar > 0 ? `<span style="margin-right: 16px;">🔑 Llave sin cargar: <strong>${summaryByType.llave_sin_cargar}</strong></span>` : ""}
          ${summaryByType.conductor_inactivo > 0 ? `<span style="margin-right: 16px;">👤 Conductor inactivo: <strong>${summaryByType.conductor_inactivo}</strong></span>` : ""}
        </div>
      </div>`
    : "";

  // Resumen automático: críticos, advertencias y administrativos
  const summarySection = `<div style="margin-bottom: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 4px;">
    <div style="font-size: 16px;">
      ${resumen.critico > 0 ? `<span style="color: #d32f2f; font-weight: bold;">🔴 ${resumen.critico} críticos</span>` : ""}
      ${resumen.advertencia > 0 ? `<span style="margin-left: 20px; color: #f57c00; font-weight: bold;">🟠 ${resumen.advertencia} advertencias</span>` : ""}
      ${resumen.administrativo > 0 ? `<span style="margin-left: 20px; color: #1976d2; font-weight: bold;">ℹ️ ${resumen.administrativo} administrativos</span>` : ""}
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
  ${typeSummaryHtml}
  
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
 * Marca una alerta como enviada.
 * Normaliza la patente antes de escribir en Firestore para garantizar consistencia.
 */
async function markAlertAsSent(dateKey, plate) {
  const normalizedPlate = normalizePlate(plate);
  const docRef = db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("vehicles")
    .doc(normalizedPlate);

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

    logger.info(`[GET-PENDING-ALERTS] Procesando ${docs.length} documentos`);

    if (docs.length === 0) {
      // Debug: obtener información sobre qué hay en Firestore
      const dailyAlertsRef = db
        .collection("apps")
        .doc("emails")
        .collection("dailyAlerts");
      const dateKeysSnap = await dailyAlertsRef.get();
      
      const debugInfo = {
        totalDateKeys: dateKeysSnap.docs.length,
        dateKeys: dateKeysSnap.docs.map(d => d.id),
        vehiclesByDate: {}
      };

      for (const dateDoc of dateKeysSnap.docs.slice(0, 5)) { // Solo primeras 5 fechas para debug
        const dateKey = dateDoc.id;
        const vehiclesSnap = await dateDoc.ref.collection("vehicles").get();
        debugInfo.vehiclesByDate[dateKey] = {
          total: vehiclesSnap.docs.length,
          vehicles: vehiclesSnap.docs.slice(0, 3).map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              plate: data.plate || doc.id,
              alertSent: data.alertSent,
              alertSentType: typeof data.alertSent
            };
          })
        };
      }

      logger.info("[GET-PENDING-ALERTS] No hay alertas pendientes. Debug:", JSON.stringify(debugInfo));
      return res.status(200).json({ 
        ok: true, 
        alerts: [],
        debug: debugInfo // Incluir debug en respuesta
      });
    }

    const alerts = await Promise.all(
      docs.map(async (doc, index) => {
        try {
          logger.info(`[GET-PENDING-ALERTS] Procesando documento ${index + 1}/${docs.length}`);
          
          const rawPlate = doc.plate || doc.id;
          const dateKey = doc.dateKey; // dateKey viene incluido en el documento
          
          // Normalizar patente para garantizar consistencia
          const plate = normalizePlate(rawPlate);
          
          logger.info(`[GET-PENDING-ALERTS] Documento: plate=${plate} (raw: ${rawPlate}), dateKey=${dateKey}`);
          
          if (!dateKey) {
            logger.warn(`[GET-PENDING-ALERTS] Documento sin dateKey: ${plate}`);
            return null;
          }
          
          const alertId = `${dateKey}_${plate}`;
          
          // Obtener responsables desde el vehículo (getVehicle normaliza internamente)
          const vehicle = await getVehicle(plate);
          const responsables = Array.isArray(vehicle?.responsables)
            ? vehicle.responsables.filter((e) => typeof e === "string" && e.includes("@"))
            : [];

          logger.info(`[GET-PENDING-ALERTS] Construyendo alerta para ${alertId}, responsables: ${responsables.length}`);

          const alert = {
            alertId,
            plate,
            responsables,
            subject: buildSubject(doc, dateKey),
            body: buildBody(doc),
          };
          
          logger.info(`[GET-PENDING-ALERTS] Alerta construida exitosamente para ${alertId}`);
          
          return alert;
        } catch (err) {
          logger.error(`[GET-PENDING-ALERTS] Error procesando documento:`, err.message, err.stack);
          return null;
        }
      })
    );

    // Filtrar nulls (documentos que fallaron al procesar)
    const validAlerts = alerts.filter(a => a !== null);

    logger.info(`[GET-PENDING-ALERTS] Retornando ${validAlerts.length} alertas válidas`);

    return res.status(200).json({ ok: true, alerts: validAlerts });
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

/**
 * GET /email/debug-pending-alerts
 * Endpoint temporal de debug para verificar qué está pasando
 */
router.get("/email/debug-pending-alerts", async (req, res) => {
  try {
    if (!validateLocalToken(req)) {
      return res.status(401).json({ error: "no autorizado" });
    }

    const dailyAlertsRef = db
      .collection("apps")
      .doc("emails")
      .collection("dailyAlerts");

    const dateKeysSnap = await dailyAlertsRef.get();
    
    const debugInfo = {
      totalDateKeys: dateKeysSnap.docs.length,
      dateKeys: dateKeysSnap.docs.map(d => d.id),
      vehiclesByDate: {}
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
