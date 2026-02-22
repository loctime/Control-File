const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const {
  parseVehicleEventsFromEmail,
  detectEmailType,
} = require("../services/vehicleEventParser");
const {
  saveVehicleEvents,
  upsertVehicle,
  getVehicle,
  createVehicleFromEvent,
  upsertDailyAlert,
  formatDateKey,
  generateDeterministicEventId,
  isFromAllowedDomain,
} = require("../services/vehicleEventService");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
let emailReceptorWarnedAutoCreateDomains = false;

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

    // --- Parseo de eventos ---
    const bodyText = body_text || "";
    const { events: rawEvents, sourceEmailType } = parseVehicleEventsFromEmail(
      emailData.subject || "",
      bodyText
    );

    const isDev = process.env.NODE_ENV !== "production";
    
    // Logs críticos después del parseo
    console.log("🔍 [EMAIL-LOCAL] ========== DESPUÉS DEL PARSEO ==========");
    console.log("🔍 [EMAIL-LOCAL] TOTAL EVENTS PARSED:", rawEvents.length);
    console.log("🔍 [EMAIL-LOCAL] PLATES:", rawEvents.map(e => e.plate));
    console.log("🔍 [EMAIL-LOCAL] Source Email Type:", sourceEmailType);
    
    // Contar líneas que parecen eventos pero no se parsearon
    let unparsedLinesCount = 0;
    if (bodyText && sourceEmailType) {
      const lines = bodyText.split(/\r?\n/);
      const eventPatterns = {
        excesos: /km\/h/i,
        no_identificados: /\d{2}\/\d{2}\/\d{2}/,
        contacto: /\d{2}-\d{2}-\d{4}/
      };
      const pattern = eventPatterns[sourceEmailType];
      if (pattern) {
        const linesWithPattern = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && pattern.test(trimmed);
        });
        unparsedLinesCount = Math.max(0, linesWithPattern.length - rawEvents.length);
        console.log(`🔍 [EMAIL-LOCAL] Líneas con patrón detectado: ${linesWithPattern.length}`);
      }
    }
    
    if (isDev) {
      console.log("📊 [EMAIL-LOCAL] Tipo detectado:", sourceEmailType);
      console.log("📊 [EMAIL-LOCAL] Eventos parseados:", rawEvents.length);
      if (unparsedLinesCount > 0) {
        console.warn("⚠️ [EMAIL-LOCAL] Líneas no parseadas:", unparsedLinesCount, "tipo:", sourceEmailType);
      }
    }

    // Si no se detectó tipo por subject, guardar en unclassifiedEmails para visibilidad
    if (!sourceEmailType) {
      const unclassifiedRef = db
        .collection("apps")
        .doc("emails")
        .collection("unclassifiedEmails")
        .doc(docId);
      await unclassifiedRef.set({
        subject: emailData.subject,
        from: emailData.from,
        preview: (bodyText || "").slice(0, 500),
        receivedAt: emailData.received_at || new Date().toISOString(),
        messageId: docId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (isDev) console.log("📋 [EMAIL-LOCAL] Email guardado en unclassifiedEmails");
    }

    let eventsCreated = 0;
    let vehiclesUpdated = 0;
    let dailyAlertsUpdated = 0;
    let eventsSkipped = 0;

    const AUTO_CREATE = process.env.AUTO_CREATE_VEHICLES === "true";
    const ALLOWED_DOMAINS = (process.env.AUTO_CREATE_ALLOWED_DOMAINS || "").trim();
    const MAX_PER_EMAIL = parseInt(process.env.AUTO_CREATE_MAX_PER_EMAIL || "50", 10);

    if (AUTO_CREATE && !ALLOWED_DOMAINS && !emailReceptorWarnedAutoCreateDomains) {
      console.warn(
        "⚠️ [EMAIL-LOCAL] AUTO_CREATE_VEHICLES está activo pero AUTO_CREATE_ALLOWED_DOMAINS está vacío. No se crearán vehículos automáticamente."
      );
      emailReceptorWarnedAutoCreateDomains = true;
    }
    let createdThisEmail = 0;

    if (rawEvents.length > 0) {
      console.log("🔍 [EMAIL-LOCAL] ========== INICIANDO PROCESAMIENTO ==========");
      console.log(`🔍 [EMAIL-LOCAL] Total eventos a procesar: ${rawEvents.length}`);
      
      const vehicleCache = new Map();
      const allEvents = [];

      for (const event of rawEvents) {
        const plate = event.plate;
        if (!plate) {
          console.warn("⚠️ [EMAIL-LOCAL] Evento sin patente, saltando:", event);
          continue;
        }
        
        console.log(`🔍 [EMAIL-LOCAL] Procesando evento para patente: ${plate}`);

        let vehicle = vehicleCache.get(plate);
        if (!vehicle) {
          vehicle = await getVehicle(plate);
          vehicleCache.set(plate, vehicle);
        }

        if (!vehicle) {
          if (!AUTO_CREATE) {
            event.vehicleRegistered = false;
            eventsSkipped++;
          } else {
            const domainOk = isFromAllowedDomain(from, ALLOWED_DOMAINS);
            const underLimit = createdThisEmail < MAX_PER_EMAIL;
            if (domainOk && underLimit) {
              vehicle = await createVehicleFromEvent(event);
              if (vehicle) {
                vehicleCache.set(plate, vehicle);
                createdThisEmail++;
                event.vehicleRegistered = true;
              } else {
                event.vehicleRegistered = false;
                eventsSkipped++;
              }
            } else {
              event.vehicleRegistered = false;
              eventsSkipped++;
              if (isDev && !domainOk) console.log("⚠️ [EMAIL-LOCAL] Dominio no permitido para auto-crear:", from);
            }
          }
        } else {
          event.vehicleRegistered = true;
        }

        event.eventId = generateDeterministicEventId(
          event.plate,
          event.eventTimestamp,
          event.rawLine
        );
        allEvents.push(event);
      }

      // Persistir TODOS los eventos (nunca descartar)
      const { created } = await saveVehicleEvents(
        allEvents,
        emailData.message_id,
        "outlook-local"
      );
      eventsCreated = created;
      if (isDev) console.log("📊 [EMAIL-LOCAL] vehicleEvents escritos:", created, "(vehicleRegistered=false:", eventsSkipped + ")");

      // IMPORTANTE:
      // Los eventos con vehicleRegistered=false se guardan en vehicleEvents
      // pero NO actualizan vehicles ni dailyAlerts.
      // Si en el futuro se activa AUTO_CREATE_VEHICLES,
      // estos eventos no se reprocesan automáticamente.
      const registeredEvents = allEvents.filter((e) => e.vehicleRegistered === true);
      
      console.log("🔍 [EMAIL-LOCAL] ========== EVENTOS REGISTRADOS ==========");
      console.log(`🔍 [EMAIL-LOCAL] Total eventos registrados: ${registeredEvents.length}`);
      console.log(`🔍 [EMAIL-LOCAL] Patentes registradas:`, registeredEvents.map(e => e.plate).join(", "));
      console.log(`🔍 [EMAIL-LOCAL] Eventos sin registrar: ${allEvents.length - registeredEvents.length}`);
      
      const updatedPlates = new Set();
      // TODO (optimización futura):
      // Agrupar por plate y ejecutar un solo upsertVehicle y upsertDailyAlert por patente
      // para mejorar performance cuando haya muchos eventos en un mismo email.
      
      console.log("🔍 [EMAIL-LOCAL] ========== ACTUALIZANDO VEHÍCULOS Y ALERTAS ==========");
      for (const event of registeredEvents) {
        try {
          console.log(`🔍 [EMAIL-LOCAL] → Procesando evento para ${event.plate} (${event.type})`);
          
          await upsertVehicle(event);
          const vehicle = vehicleCache.get(event.plate);
          if (vehicle) {
            const eventDateKey =
              event.eventTimestamp &&
              /^\d{4}-\d{2}-\d{2}/.test(event.eventTimestamp)
                ? event.eventTimestamp.slice(0, 10)
                : formatDateKey(new Date());

            console.log(`🔍 [EMAIL-LOCAL] → Llamando upsertDailyAlert para ${event.plate} en fecha ${eventDateKey}`);
            await upsertDailyAlert(
              eventDateKey,
              event.plate,
              vehicle,
              event
            );

            updatedPlates.add(event.plate);
            console.log(`🔍 [EMAIL-LOCAL] ✅ Completado para ${event.plate}`);
          } else {
            console.warn(`⚠️ [EMAIL-LOCAL] Vehículo no encontrado en cache para ${event.plate}`);
          }
        } catch (err) {
          console.error(
            `❌ [EMAIL-LOCAL] Error procesando evento ${event.eventId} (${event.plate}):`,
            err.message
          );
          console.error("Stack:", err.stack);
          continue;
        }
      }
      
      console.log("🔍 [EMAIL-LOCAL] ========== RESUMEN FINAL ==========");
      console.log(`🔍 [EMAIL-LOCAL] Patentes actualizadas: ${updatedPlates.size}`);
      console.log(`🔍 [EMAIL-LOCAL] Lista de patentes:`, Array.from(updatedPlates).join(", "));
      vehiclesUpdated = updatedPlates.size;
      dailyAlertsUpdated = updatedPlates.size;
      if (isDev) console.log("📊 [EMAIL-LOCAL] Vehículos actualizados:", vehiclesUpdated);
      if (isDev) console.log("📊 [EMAIL-LOCAL] dailyAlerts actualizados:", dailyAlertsUpdated);
    }

    return res.status(200).json({
      ok: true,
      message_id: emailData.message_id,
      ingested_at: emailData.ingested_at,
      vehicle_events: rawEvents.length,
      vehicle_events_created: eventsCreated,
      vehicle_events_skipped: eventsSkipped,
      vehicles_updated: vehiclesUpdated,
      daily_alerts_updated: dailyAlertsUpdated,
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
