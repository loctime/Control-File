const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

router.post("/email-local-ingest", async (req, res) => {
  try {
    // Validación de token de autenticación local
    const LOCAL_EMAIL_TOKEN = process.env.LOCAL_EMAIL_TOKEN;
    
    if (!LOCAL_EMAIL_TOKEN) {
      console.error("❌ [EMAIL-LOCAL] LOCAL_EMAIL_TOKEN no configurado");
      return res.status(500).json({ error: "configuración del servidor incorrecta" });
    }

    if (req.headers["x-local-token"] !== LOCAL_EMAIL_TOKEN) {
      console.warn("⚠️ [EMAIL-LOCAL] Intento de acceso no autorizado desde:", req.ip);
      return res.status(401).json({ error: "no autorizado" });
    }

    const { source, email } = req.body;

    if (source !== "outlook-local" || !email) {
      return res.status(400).json({ error: "payload inválido" });
    }

    const {
      message_id,
      from,
      to,
      subject,
      body_text,
      body_html,
      received_at,
      attachments
    } = email;

    // Validación de campos requeridos
    if (!from || !subject || (!body_text && !body_html)) {
      return res.status(400).json({ 
        error: "email incompleto",
        missing: {
          from: !from,
          subject: !subject,
          body: !body_text && !body_html
        }
      });
    }

    // Normalizar arrays
    const normalizedTo = Array.isArray(to) ? to : (to ? [to] : []);
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

    const emailData = {
      source: "outlook-local",
      message_id: message_id || null,
      from,
      to: normalizedTo,
      subject,
      body_text: body_text || null,
      body_html: body_html || null,
      attachments: normalizedAttachments,
      received_at: received_at || new Date().toISOString(),
      ingested_at: new Date().toISOString()
    };

    console.log("📥 [EMAIL-LOCAL] Email recibido:");
    console.log({
      from: emailData.from,
      subject: emailData.subject,
      to_count: emailData.to.length,
      has_text: !!emailData.body_text,
      has_html: !!emailData.body_html,
      attachments_count: emailData.attachments.length
    });

    // TODO: persistir en Firestore
    // const db = admin.firestore();
    // await db.collection("apps/emails/inbox").add(emailData);

    return res.status(200).json({ 
      ok: true,
      message_id: emailData.message_id,
      ingested_at: emailData.ingested_at
    });

  } catch (err) {
    console.error("❌ [EMAIL-LOCAL] Error:", err.message);
    console.error("Stack:", err.stack);
    return res.status(500).json({ 
      error: "error interno",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

module.exports = router;
