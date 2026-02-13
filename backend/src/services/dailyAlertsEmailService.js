/**
 * dailyAlertsEmailService.js
 * Servicio para enviar alertas diarias por email a responsables de vehículos.
 * Usa nodemailer.
 */

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { logger } = require("../utils/logger");

function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
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
 * Crea el transport de nodemailer según variables de entorno.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP no configurado. Requiere: SMTP_HOST, SMTP_USER, SMTP_PASS"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Obtiene los documentos de dailyAlerts no enviados para una fecha.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<Array<object>>}
 */
async function getUnsentDailyAlerts(dateKey) {
  const db = getDb();
  const vehiclesSnap = await db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("vehicles")
    .where("alertSent", "==", false)
    .get();

  const docs = [];
  vehiclesSnap.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
  return docs;
}

/**
 * Genera el cuerpo HTML del email de alerta para un vehículo.
 */
function buildAlertHtml(vehicleDoc) {
  const { plate, brand, model, eventCount, events } = vehicleDoc;
  const eventRows = (events || [])
    .map(
      (e) =>
        `<tr><td>${e.speed} km/h</td><td>${e.eventTimestamp || "-"}</td><td>${e.location || "-"}</td><td>${e.severity || "info"}</td></tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
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
        <th>Severidad</th>
      </tr>
    </thead>
    <tbody>${eventRows}</tbody>
  </table>
  <p style="margin-top: 20px; color: #666; font-size: 12px;">
    Este es un resumen automático del día ${new Date().toLocaleDateString("es-AR")}.
  </p>
</body>
</html>
  `.trim();
}

/**
 * Genera el cuerpo texto plano del email.
 */
function buildAlertText(vehicleDoc) {
  const { plate, brand, model, eventCount, events } = vehicleDoc;
  const lines = [
    `Alertas diarias - ${plate}`,
    `Vehículo: ${brand || "-"} ${model || "-"}`,
    `Total de eventos: ${eventCount || 0}`,
    "",
  ];
  (events || []).forEach((e) => {
    lines.push(
      `  - ${e.speed} km/h | ${e.eventTimestamp || "-"} | ${e.location || "-"} | ${e.severity || "info"}`
    );
  });
  return lines.join("\n");
}

/**
 * Envía email a un conjunto de destinatarios.
 * @param {object} transporter - Nodemailer transport
 * @param {string[]} to - Emails destinatarios
 * @param {string} subject - Asunto
 * @param {string} html - Cuerpo HTML
 * @param {string} text - Cuerpo texto
 */
async function sendEmail(transporter, to, subject, html, text) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@controlfile.app";

  await transporter.sendMail({
    from,
    to: to.join(", "),
    subject,
    html,
    text,
  });
}

/**
 * Marca un documento dailyAlert como enviado.
 */
async function markAlertAsSent(dateKey, plate) {
  const db = getDb();
  await db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .doc(dateKey)
    .collection("vehicles")
    .doc(plate)
    .update({ alertSent: true });
}

/**
 * Procesa y envía todas las alertas diarias pendientes para la fecha actual.
 * @param {string} [dateKey] - Opcional, YYYY-MM-DD. Por defecto hoy.
 * @returns {{ sent: number, failed: number, errors: string[] }}
 */
async function sendDailyAlerts(dateKey) {
  const targetDate = dateKey || formatDateKey(new Date());
  const results = { sent: 0, failed: 0, errors: [] };

  const unsent = await getUnsentDailyAlerts(targetDate);
  if (unsent.length === 0) {
    logger.info("[DAILY-ALERTS] No hay alertas pendientes para", targetDate);
    return results;
  }

  let transporter;
  try {
    transporter = createTransporter();
  } catch (err) {
    logger.error("[DAILY-ALERTS] Error configurando SMTP:", err.message);
    results.errors.push(err.message);
    return results;
  }

  for (const doc of unsent) {
    const responsables = Array.isArray(doc.responsables)
      ? doc.responsables.filter((e) => typeof e === "string" && e.includes("@"))
      : [];

    if (responsables.length === 0) {
      logger.warn("[DAILY-ALERTS] Sin responsables para", doc.plate);
      results.failed++;
      results.errors.push(`Sin responsables válidos para ${doc.plate}`);
      continue;
    }

    const subject = `[ControlFile] Alertas vehículo ${doc.plate} - ${targetDate}`;
    const html = buildAlertHtml(doc);
    const text = buildAlertText(doc);

    try {
      await sendEmail(transporter, responsables, subject, html, text);
      await markAlertAsSent(targetDate, doc.plate);
      results.sent++;
      logger.info("[DAILY-ALERTS] Email enviado a responsables de", doc.plate);
    } catch (err) {
      results.failed++;
      results.errors.push(`${doc.plate}: ${err.message}`);
      logger.error("[DAILY-ALERTS] Error enviando a", doc.plate, err.message);
    }
  }

  return results;
}

module.exports = {
  getUnsentDailyAlerts,
  sendDailyAlerts,
  formatDateKey,
  createTransporter,
};
