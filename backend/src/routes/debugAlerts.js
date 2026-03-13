const express = require("express");
const router = express.Router();
const { simulateAlertFromEmail } = require("../services/alertSimulationService");

router.post("/debug/simulate-alert", async (req, res) => {
  try {
    const body = req.body || {};
    const subject = typeof body.subject === "string" ? body.subject : "";
    const emailBody = typeof body.body === "string" ? body.body : "";
    const receivedAt = body.received_at == null ? null : String(body.received_at);

    if (!subject.trim() && !emailBody.trim()) {
      return res.status(400).json({
        error: "subject or body is required",
      });
    }

    const result = simulateAlertFromEmail({
      subject,
      body: emailBody,
      receivedAt,
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
