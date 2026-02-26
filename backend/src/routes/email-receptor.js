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
  upsertDailyAlertBatch,
  updateDailyMetaBatch,
  buildEventSummary,
  formatDateKey,
  generateDeterministicEventId,
  isFromAllowedDomain,
  normalizePlate,
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
    
    // Contar líneas que parecen eventos pero no se parsearon (v2: registrar para auditoría)
    let unparsedLinesCount = 0;
    let linesWithPatternCount = 0;
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
        linesWithPatternCount = linesWithPattern.length;
        unparsedLinesCount = Math.max(0, linesWithPatternCount - rawEvents.length);
        console.log(`🔍 [EMAIL-LOCAL] Líneas con patrón detectado: ${linesWithPatternCount}`);
      }
    }

    if (unparsedLinesCount > 0) {
      const inboxRef = db.collection("apps").doc("emails").collection("inbox").doc(docId);
      await inboxRef.update({
        unparsedSummary: {
          sourceEmailType: sourceEmailType || null,
          linesWithPattern: linesWithPatternCount,
          parsedCount: rawEvents.length,
          diff: unparsedLinesCount,
          at: new Date().toISOString(),
        },
      });
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
        const rawPlate = event.plate;
        if (!rawPlate) {
          console.warn("⚠️ [EMAIL-LOCAL] Evento sin patente, saltando:", event);
          continue;
        }
        
        // Normalizar patente ANTES de cualquier operación para garantizar consistencia
        const plate = normalizePlate(rawPlate);
        console.log(`🔍 [EMAIL-LOCAL] Procesando evento para patente: ${plate} (raw: ${rawPlate})`);

        // Actualizar event.plate con la patente normalizada para consistencia
        event.plate = plate;

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

      // Persistir eventos (duplicados por eventId se omiten y se cuentan como skipped)
      const { created, skipped: duplicatesSkipped } = await saveVehicleEvents(
        allEvents,
        emailData.message_id,
        "outlook-local"
      );
      eventsCreated = created;
      if (duplicatesSkipped > 0) {
        console.warn(`⚠️ [EMAIL-LOCAL] Eventos duplicados omitidos en vehicleEvents: ${duplicatesSkipped}`);
      }
      if (isDev) console.log("📊 [EMAIL-LOCAL] vehicleEvents escritos:", created, "duplicados omitidos:", duplicatesSkipped, "(vehicleRegistered=false:", eventsSkipped + ")");

      // Eventos con vehicleRegistered=false no actualizan vehicles ni dailyAlerts
      const registeredEvents = allEvents.filter((e) => e.vehicleRegistered === true);

      console.log("🔍 [EMAIL-LOCAL] ========== EVENTOS REGISTRADOS ==========");
      console.log(`🔍 [EMAIL-LOCAL] Total eventos registrados: ${registeredEvents.length}`);
      console.log(`🔍 [EMAIL-LOCAL] Patentes:`, [...new Set(registeredEvents.map((e) => e.plate))].join(", "));

      // Acumulador en memoria: dateKey -> plate -> { vehicle, eventIds, eventSummaries }
      const accumulator = new Map();

      for (const event of registeredEvents) {
        const dateKey =
          event.eventTimestamp && /^\d{4}-\d{2}-\d{2}/.test(String(event.eventTimestamp))
            ? String(event.eventTimestamp).slice(0, 10)
            : formatDateKey(new Date());
        const plate = event.plate;
        const eventSummary = buildEventSummary(event);

        if (!accumulator.has(dateKey)) accumulator.set(dateKey, new Map());
        const byPlate = accumulator.get(dateKey);
        if (!byPlate.has(plate)) {
          const vehicle = vehicleCache.get(plate);
          if (!vehicle) continue;
          byPlate.set(plate, { vehicle, eventIds: new Set(), eventSummaries: [] });
        }
        const bucket = byPlate.get(plate);
        if (bucket.eventIds.has(eventSummary.eventId)) continue;
        bucket.eventIds.add(eventSummary.eventId);
        bucket.eventSummaries.push(eventSummary);
      }

      const uniquePlates = new Set(registeredEvents.map((e) => e.plate));
      const totalBuckets = Array.from(accumulator.values()).reduce((sum, m) => sum + m.size, 0);
      console.log("🔍 [EMAIL-LOCAL] ========== EVENTOS AGRUPADOS ==========");
      console.log(`🔍 [EMAIL-LOCAL] Fechas: ${accumulator.size} | Vehículos únicos (día/patente): ${totalBuckets} | Patentes: ${uniquePlates.size}`);
      for (const [dk, byPlate] of accumulator) {
        const plates = Array.from(byPlate.keys()).join(", ");
        const counts = Array.from(byPlate.entries()).map(([p, b]) => `${p}:${b.eventSummaries.length}`).join(" ");
        console.log(`🔍 [EMAIL-LOCAL]   ${dk} → ${plates} | ${counts}`);
      }

      // Una actualización de vehicle por patente (usar el evento más reciente por timestamp)
      const plateToLatestEvent = new Map();
      for (const event of registeredEvents) {
        const plate = event.plate;
        const ts = event.eventTimestamp || "";
        if (!plateToLatestEvent.has(plate) || (plateToLatestEvent.get(plate).eventTimestamp || "") < ts) {
          plateToLatestEvent.set(plate, event);
        }
      }
      console.log("🔍 [EMAIL-LOCAL] ========== ACTUALIZANDO VEHÍCULOS (1 por patente) ==========");
      for (const [plate, event] of plateToLatestEvent) {
        try {
          await upsertVehicle(event);
        } catch (err) {
          console.error(`❌ [EMAIL-LOCAL] Error upsertVehicle ${plate}:`, err.message);
        }
      }

      // Una escritura por (dateKey, plate) en dailyAlerts; meta agregada por dateKey
      const metaByDate = new Map();
      let dailyAlertWrites = 0;

      console.log("🔍 [EMAIL-LOCAL] ========== ACTUALIZANDO DAILY ALERTS (1 por vehículo/día) ==========");
      for (const [dateKey, byPlate] of accumulator) {
        for (const [plate, bucket] of byPlate) {
          if (bucket.eventSummaries.length === 0) continue;
          try {
            const result = await upsertDailyAlertBatch(dateKey, plate, bucket.vehicle, bucket.eventSummaries);
            if (result.metaDeltas) {
              dailyAlertWrites++;
              const prev = metaByDate.get(dateKey) || {};
              const d = result.metaDeltas;
              metaByDate.set(dateKey, {
                totalEvents: (prev.totalEvents || 0) + (d.totalEvents || 0),
                totalVehicles: (prev.totalVehicles || 0) + (d.totalVehicles || 0),
                totalExcesos: (prev.totalExcesos || 0) + (d.totalExcesos || 0),
                totalNoIdentificados: (prev.totalNoIdentificados || 0) + (d.totalNoIdentificados || 0),
                totalContactos: (prev.totalContactos || 0) + (d.totalContactos || 0),
                totalLlaveSinCargar: (prev.totalLlaveSinCargar || 0) + (d.totalLlaveSinCargar || 0),
                totalConductorInactivo: (prev.totalConductorInactivo || 0) + (d.totalConductorInactivo || 0),
                totalCriticos: (prev.totalCriticos || 0) + (d.totalCriticos || 0),
                totalAdvertencias: (prev.totalAdvertencias || 0) + (d.totalAdvertencias || 0),
                totalAdministrativos: (prev.totalAdministrativos || 0) + (d.totalAdministrativos || 0),
                vehiclesWithCritical: (prev.vehiclesWithCritical || 0) + (d.vehiclesWithCritical || 0),
              });
            }
          } catch (err) {
            console.error(`❌ [EMAIL-LOCAL] Error upsertDailyAlertBatch ${dateKey}/${plate}:`, err.message);
          }
        }
      }

      for (const [dateKey, deltas] of metaByDate) {
        await updateDailyMetaBatch(dateKey, deltas);
      }

      const updatedPlates = new Set([...accumulator.values()].flatMap((m) => [...m.keys()]));
      console.log("🔍 [EMAIL-LOCAL] ========== RESUMEN FINAL ==========");
      console.log(`🔍 [EMAIL-LOCAL] Vehículos actualizados (vehicles): ${plateToLatestEvent.size}`);
      console.log(`🔍 [EMAIL-LOCAL] Escrituras dailyAlerts (1 por vehículo/día): ${dailyAlertWrites}`);
      console.log(`🔍 [EMAIL-LOCAL] Patentes con alertas: ${updatedPlates.size} → ${Array.from(updatedPlates).join(", ")}`);
      vehiclesUpdated = plateToLatestEvent.size;
      dailyAlertsUpdated = dailyAlertWrites;
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
