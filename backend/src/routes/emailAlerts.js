/**
 * Rutas para envío de alertas diarias por email.
 * POST /api/email/send-daily-alerts
 */

const express = require("express");
const router = express.Router();
const { sendDailyAlerts } = require("../services/dailyAlertsEmailService");
const { logger } = require("../utils/logger");

/**
 * POST /email/send-daily-alerts
 *
 * Busca dailyAlerts con alertSent === false para la fecha actual,
 * envía emails a responsables y marca alertSent = true.
 *
 * Auth: x-local-token (mismo que email-local-ingest)
 * Body opcional: { date?: "YYYY-MM-DD" } para forzar una fecha
 */
router.post("/email/send-daily-alerts", async (req, res) => {
  try {
    const LOCAL_EMAIL_TOKEN = process.env.LOCAL_EMAIL_TOKEN;

    if (!LOCAL_EMAIL_TOKEN) {
      logger.error("[SEND-DAILY-ALERTS] LOCAL_EMAIL_TOKEN no configurado");
      return res.status(500).json({ error: "configuración del servidor incorrecta" });
    }

    if (req.headers["x-local-token"] !== LOCAL_EMAIL_TOKEN) {
      logger.warn("[SEND-DAILY-ALERTS] Intento de acceso no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const dateKey = req.body?.date || null;
    const result = await sendDailyAlerts(dateKey);

    return res.status(200).json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err) {
    logger.error("[SEND-DAILY-ALERTS] Error:", err.message, err.stack);
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

module.exports = router;
