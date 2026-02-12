const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { parseVehicleEventsFromBody } = require("../services/vehicleEventParser");
const { saveVehicleEvents, upsertVehicle } = require("../services/vehicleEventService");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

    // Usar message_id para evitar duplicados
    const docId = message_id || db.collection("_").doc().id;

    await db
      .collection("apps")
      .doc("emails")
      .collection("inbox")
      .doc(docId)
      .set({
        ...emailData,
        preview: (body_text || "").slice(0, 200),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log("✅ [EMAIL-LOCAL] Email guardado en Firestore con ID:", docId);

    // --- Procesamiento de eventos de vehículos ---
    const bodyText = body_text || "";
    const events = parseVehicleEventsFromBody(bodyText);

    const linesWithKmh = bodyText.split(/\r?\n/).filter((line) => /Km\/h/i.test(line)).length;
    console.log("📊 [EMAIL-LOCAL] Líneas con Km/h detectadas:", linesWithKmh);
    console.log("📊 [EMAIL-LOCAL] Eventos parseados:", events.length);

    let eventsCreated = 0;
    let vehiclesUpdated = 0;

    if (events.length > 0) {
      const { created, skipped } = await saveVehicleEvents(
        events,
        emailData.message_id,
        "outlook-local"
      );
      eventsCreated = created;
      console.log("📊 [EMAIL-LOCAL] vehicleEvents: creados:", created, "omitidos (duplicados):", skipped);

      const updatedPlates = new Set();
      for (const event of events) {
        await upsertVehicle(event);
        updatedPlates.add(event.plate);
      }
      vehiclesUpdated = updatedPlates.size;
      console.log("📊 [EMAIL-LOCAL] Vehículos actualizados:", vehiclesUpdated);
    }

    return res.status(200).json({ 
      ok: true,
      message_id: emailData.message_id,
      ingested_at: emailData.ingested_at,
      vehicle_events: events.length,
      vehicle_events_created: eventsCreated,
      vehicles_updated: vehiclesUpdated
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
