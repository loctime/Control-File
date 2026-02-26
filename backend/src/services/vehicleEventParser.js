/**
 * vehicleEventParser.js
 * Parsea líneas de telemetría de velocidad desde body_text de emails.
 * Soporta: Excesos del día, No identificados del día, Contacto sin identificación del día.
 * Formato excesos: "132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ..."
 */

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_OFFSET = "-03:00";

const isDev = process.env.NODE_ENV !== "production";

// Tipos de email reconocidos
const EMAIL_TYPE_EXCESOS = "excesos";
const EMAIL_TYPE_NO_IDENTIFICADOS = "no_identificados";
const EMAIL_TYPE_CONTACTO = "contacto";

// Patrones para detectar tipo de email por subject
const SUBJECT_PATTERNS = {
  excesos: /excesos?\s+(del\s+)?d[íi]a/i,
  no_identificados: /no\s+identificados?\s+(del\s+)?d[íi]a/i,
  contacto: /contacto\s+sin\s+identificaci[oó]n\s+(del\s+)?d[íi]a/i,
};

// Palabras clave que indican inicio de ubicación (case-insensitive)
const LOCATION_KEYWORDS = [
  "desconocido",
  "ruta",
  "rp",
  "rn",
  "av",
  "av.",
  "calle",
  "km",
  "autopista",
  "panamericana",
  "acceso",
];

/**
 * Formatea timestamp en ISO con offset local (Argentina).
 * Preserva la hora exacta del evento sin conversión UTC.
 */
function formatLocalTimestamp(fullYear, month, day, hh, min, ss) {
  const y = String(fullYear);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const H = String(hh).padStart(2, "0");
  const M = String(min).padStart(2, "0");
  const S = String(ss).padStart(2, "0");
  return `${y}-${m}-${d}T${H}:${M}:${S}${ARGENTINA_OFFSET}`;
}

/**
 * Parsea brand, model y location desde el texto después de la patente.
 * Tolera modelos multi-palabra (ej: NISSAN FRONTIER XE).
 */
function parseBrandModelLocation(rest) {
  if (!rest || typeof rest !== "string") {
    return { brand: "", model: "", location: "" };
  }

  const parts = rest.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { brand: "", model: "", location: "" };

  const brand = parts[0] || "";
  let modelStart = 1;
  let locationStart = -1;

  for (let i = 1; i < parts.length; i++) {
    const lower = parts[i].toLowerCase();
    if (LOCATION_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + "."))) {
      locationStart = i;
      break;
    }
  }

  const model =
    locationStart > 0
      ? parts.slice(modelStart, locationStart).join(" ")
      : parts.slice(modelStart).join(" ");
  const location =
    locationStart >= 0 ? parts.slice(locationStart).join(" ").replace(/^\.\.\.|\.\.\.$/g, "").trim() : "";

  return { brand, model, location };
}

/**
 * Detecta el tipo de email según subject (y opcionalmente body).
 * Maneja caracteres corruptos y hace búsquedas más flexibles.
 * @param {string} subject - Asunto del email
 * @param {string} [bodyText] - Cuerpo en texto plano (opcional)
 * @returns {string|null} "excesos" | "no_identificados" | "contacto" | null
 */
function detectEmailType(subject, bodyText) {
  if (!subject || typeof subject !== "string") return null;
  const s = subject.trim();
  if (s.length === 0) return null;
  
  // Normalizar para manejar caracteres corruptos (ej: "Identificaci�n" -> buscar "identificacion")
  const normalized = s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remover acentos
    .replace(/[^\w\s]/g, "") // Remover caracteres especiales excepto espacios
    .replace(/\s+/g, " "); // Normalizar espacios
  
  console.log(`[DETECT-EMAIL-TYPE] Subject original: "${s}"`);
  console.log(`[DETECT-EMAIL-TYPE] Subject normalizado: "${normalized}"`);

  // Prioridad 1: Contacto sin identificación (debe ir ANTES de "no identificados"
  // para que "Contacto sin identificación del día" no matchee como no_identificados)
  if (SUBJECT_PATTERNS.contacto.test(s) || /contacto\s+sin\s+identific/i.test(normalized)) {
    console.log(`[DETECT-EMAIL-TYPE] ✅ Detectado: CONTACTO`);
    return EMAIL_TYPE_CONTACTO;
  }
  // Prioridad 2: No identificados del día
  if (SUBJECT_PATTERNS.no_identificados.test(s) ||
      /no\s+identific/i.test(normalized) ||
      /falta\s+identific/i.test(normalized) ||
      /sin\s+identific/i.test(normalized)) {
    console.log(`[DETECT-EMAIL-TYPE] ✅ Detectado: NO_IDENTIFICADOS`);
    return EMAIL_TYPE_NO_IDENTIFICADOS;
  }
  // Prioridad 3: Excesos del día
  if (SUBJECT_PATTERNS.excesos.test(s) ||
      /exceso/i.test(normalized) ||
      /velocidad/i.test(normalized)) {
    console.log(`[DETECT-EMAIL-TYPE] ✅ Detectado: EXCESOS`);
    return EMAIL_TYPE_EXCESOS;
  }
  
  console.log(`[DETECT-EMAIL-TYPE] ⚠️ No se pudo detectar tipo de email`);
  return null;
}

/**
 * Parsea una línea que contiene "Km/h" y extrae los datos del evento.
 * @param {string} line - Línea de texto
 * @returns {object|null} Objeto evento o null si no es válida
 */
function parseLine(line) {
  if (!line || typeof line !== "string") return null;

  const trimmed = line.trim().replace(/\s+/g, " ");
  if (!trimmed.toLowerCase().includes("km/h")) return null;

  // Patrón flexible: speed Km/h fecha hora plate - brandModelLocation
  const regex =
    /(\d+)\s+km\/h\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9\-\s]+?)\s+-\s+(.+)/i;
  const match = trimmed.match(regex);
  if (!match) {
    if (isDev) console.log("[VEHICLE-PARSER] Línea no coincide con patrón:", trimmed.slice(0, 80));
    return null;
  }

  const [, speedStr, fechaStr, horaStr, plateRaw, brandModelRest] = match;
  const speed = parseInt(speedStr, 10);
  if (isNaN(speed) || speed <= 0) {
    if (isDev) console.log("[VEHICLE-PARSER] Velocidad inválida:", speedStr);
    return null;
  }

  const [dd, mm, yy] = fechaStr.split("/").map((n) => parseInt(n, 10));
  const [hh, min, ss] = horaStr.split(":").map((n) => parseInt(n, 10));
  const fullYear = yy >= 0 && yy <= 99 ? 2000 + yy : yy;
  const monthNum = mm;

  if (isNaN(dd) || isNaN(mm) || isNaN(yy) || isNaN(hh) || isNaN(min) || isNaN(ss)) {
    if (isDev) console.log("[VEHICLE-PARSER] Fecha/hora inválida:", fechaStr, horaStr);
    return null;
  }

  const eventDate = new Date(fullYear, monthNum - 1, dd, hh, min, ss);
  if (isNaN(eventDate.getTime())) {
    if (isDev) console.log("[VEHICLE-PARSER] Fecha no válida:", fechaStr, horaStr);
    return null;
  }

  const eventTimestamp = formatLocalTimestamp(fullYear, monthNum, dd, hh, min, ss);
  const eventDateStr = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yy}`;
  const eventTimeStr = horaStr;

  const plate = plateRaw.replace(/\s+/g, " ").trim();
  if (!plate) return null;

  const { brand, model, location } = parseBrandModelLocation(brandModelRest);

  let severity = "info";
  if (speed >= 130) severity = "critico";
  else if (speed >= 110) severity = "advertencia";

  return {
    speed,
    fecha: eventDateStr,
    hora: eventTimeStr,
    plate,
    brand,
    model,
    location,
    eventTimestamp,
    eventDate: eventDateStr,
    eventTime: eventTimeStr,
    eventCategory: "exceso_velocidad",
    severity,
    timezone: DEFAULT_TIMEZONE,
    rawLine: trimmed,
  };
}

/**
 * Parsea body_text y devuelve array de eventos listos para persistir.
 * Wrapper que llama a parseVehicleEventsFromEmail para compatibilidad.
 * @param {string} bodyText - Cuerpo del email en texto plano
 * @param {string} [subject] - Asunto del email (opcional, para detectar tipo)
 * @returns {Array<object>} Array de objetos evento
 */
function parseVehicleEventsFromBody(bodyText, subject = "") {
  const { events } = parseVehicleEventsFromEmail(subject, bodyText || "");
  return events;
}

/**
 * Parsea body_text para emails tipo "Excesos del día".
 * Clasificación: exceso, sin_llave, llave_no_registrada, conductor_inactivo.
 * @param {string} bodyText - Cuerpo del email en texto plano
 * @returns {Array<object>} Eventos con type y severity según contenido
 */
function parseExcesos(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const lines = bodyText.split(/\r?\n/);
  const events = [];

  if (isDev) {
    console.log(`[PARSE-EXCESOS] Total de líneas en email: ${lines.length}`);
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    
    if (isDev && trimmed.length > 0) {
      console.log(`[PARSE-EXCESOS] Línea ${lineIndex + 1}: ${trimmed.slice(0, 100)}`);
    }
    
    if (!trimmed.toLowerCase().includes("km/h")) {
      if (isDev && trimmed.length > 0) {
        console.log(`[PARSE-EXCESOS] Línea ${lineIndex + 1} no contiene km/h, saltando`);
      }
      continue;
    }

    // Regex mejorado: captura patente con espacios y guiones, más flexible
    const regex =
      /(\d+)\s+km\/h\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9\-\s]+?)\s+-\s+(.+)/i;

    const match = trimmed.match(regex);
    if (!match) {
      if (isDev) {
        console.warn(`[PARSE-EXCESOS] Línea ${lineIndex + 1} no coincide con regex: ${trimmed.slice(0, 100)}`);
      }
      continue;
    }
    
    if (isDev) {
      console.log(`[PARSE-EXCESOS] ✅ Match encontrado en línea ${lineIndex + 1}`);
    }

    const [, speedStr, fechaStr, horaStr, plateRaw, rest] = match;

    const speed = parseInt(speedStr, 10);
    const [dd, mm, yy] = fechaStr.split("/");
    const fullYear = 2000 + parseInt(yy, 10);

    const eventTimestamp = formatLocalTimestamp(
      fullYear,
      parseInt(mm, 10),
      parseInt(dd, 10),
      ...horaStr.split(":").map(n => parseInt(n, 10))
    );

    const plate = plateRaw.replace(/\s+/g, "").toUpperCase();
    
    if (isDev) {
      console.log(`[PARSE-EXCESOS] Patente extraída: "${plateRaw}" → "${plate}"`);
    }
    
    // Extraer reason ANTES de parsear ubicación para que la ubicación no incluya el texto del paréntesis
    let reason = null;
    const reasonMatch = rest.match(/\(([^)]+)\)/);
    if (reasonMatch && reasonMatch[1]) {
      reason = reasonMatch[1].trim();
    }
    
    // Remover el paréntesis del rest para parsear ubicación limpia
    const restForLocation = rest.replace(/\([^)]+\)/, "").trim();
    const { brand, model, location } = parseBrandModelLocation(restForLocation);

    // ---- CLASIFICACIÓN INTELIGENTE ----
    // Usar rest original (con paréntesis) para la clasificación
    let type = "exceso";
    let severity = "info";

    // Clasificación interna por type (no modifica reason)
    if (/\(sin llave\)/i.test(rest)) {
      type = "sin_llave";
      severity = "critico";
    } else if (/\(llave sin cargar/i.test(rest)) {
      type = "llave_no_registrada";
      severity = "advertencia";
    } else if (/\(conductor inactivo/i.test(rest)) {
      type = "conductor_inactivo";
      severity = "advertencia";
    }

    // Si sigue siendo exceso normal, severidad por velocidad
    if (type === "exceso") {
      if (speed >= 130) severity = "critico";
      else if (speed >= 110) severity = "advertencia";
    }

    events.push({
      type,
      eventCategory: "exceso_velocidad",
      speed,
      hasSpeed: true,
      plate,
      brand,
      model,
      location,
      eventTimestamp,
      severity,
      rawLine: trimmed,
      reason
    });

    if (isDev) {
      console.log(`[PARSE-EXCESOS] ✅ Evento parseado: ${plate} - ${speed} km/h - Tipo: ${type}`);
    }
  }

  if (isDev) {
    console.log(`[PARSE-EXCESOS] Total eventos parseados: ${events.length}`);
    console.log(`[PARSE-EXCESOS] Patentes encontradas:`, events.map(e => e.plate).join(", "));
  }

  return events;
}

/**
 * Parsea body_text para emails tipo "No identificados del día".
 * Clasificación por razón: no_identificado, llave_no_registrada, conductor_inactivo.
 * @param {string} bodyText - Cuerpo del email en texto plano
 * @returns {Array<object>} Eventos con type y severity según razón
 */
function parseNoIdentificados(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const lines = bodyText.split(/\r?\n/);
  const events = [];

  if (isDev) {
    console.log(`[PARSE-NO-ID] Total de líneas en email: ${lines.length}`);
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    
    if (isDev && trimmed.length > 0) {
      console.log(`[PARSE-NO-ID] Línea ${lineIndex + 1}: ${trimmed.slice(0, 100)}`);
    }
    
    if (!trimmed.match(/\d{2}\/\d{2}\/\d{2}/)) {
      if (isDev && trimmed.length > 0) {
        console.log(`[PARSE-NO-ID] Línea ${lineIndex + 1} no contiene fecha DD/MM/YY, saltando`);
      }
      continue;
    }

    const regex =
      /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9\-]+)\s+-\s+(.+)\((.+)\)/i;

    const match = trimmed.match(regex);
    if (!match) {
      if (isDev) {
        console.warn(`[PARSE-NO-ID] Línea ${lineIndex + 1} no coincide con regex: ${trimmed.slice(0, 100)}`);
      }
      continue;
    }
    
    if (isDev) {
      console.log(`[PARSE-NO-ID] ✅ Match encontrado en línea ${lineIndex + 1}`);
    }

    const [, fechaStr, horaStr, plateRaw, brandModel, reasonRaw] = match;

    const [dd, mm, yy] = fechaStr.split("/");
    const fullYear = 2000 + parseInt(yy, 10);

    const eventTimestamp = formatLocalTimestamp(
      fullYear,
      parseInt(mm, 10),
      parseInt(dd, 10),
      ...horaStr.split(":").map(n => parseInt(n, 10))
    );

    const plate = plateRaw.trim().toUpperCase();
    
    if (isDev) {
      console.log(`[PARSE-NO-ID] Patente extraída: "${plateRaw}" → "${plate}"`);
    }
    
    const parts = brandModel.trim().split(" ");
    const brand = parts[0] || "";
    const model = parts.slice(1).join(" ");

    const reason = reasonRaw.trim();

    let type = "no_identificado";
    let severity = "critico";

    if (/llave sin cargar/i.test(reason)) {
      type = "llave_no_registrada";
      severity = "advertencia";
    } else if (/conductor inactivo/i.test(reason)) {
      type = "conductor_inactivo";
      severity = "advertencia";
    }

    events.push({
      type,
      eventCategory: "no_identificado",
      speed: null,
      hasSpeed: false,
      plate,
      brand,
      model,
      location: "",
      eventTimestamp,
      severity,
      rawLine: trimmed,
      reason
    });

    if (isDev) {
      console.log(`[PARSE-NO-ID] ✅ Evento parseado: ${plate} - Tipo: ${type}`);
    }
  }

  if (isDev) {
    console.log(`[PARSE-NO-ID] Total eventos parseados: ${events.length}`);
    console.log(`[PARSE-NO-ID] Patentes encontradas:`, events.map(e => e.plate).join(", "));
  }

  return events;
}

/**
 * Parsea body_text para emails tipo "Contacto sin identificación del día".
 * @param {string} bodyText - Cuerpo del email en texto plano
 * @returns {Array<object>} Eventos con type "contacto"
 */
function parseContactoSinIdentificacion(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const lines = bodyText.split(/\r?\n/);
  const events = [];

  if (isDev) {
    console.log(`[PARSE-CONTACTO] Total de líneas en email: ${lines.length}`);
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    
    if (isDev && trimmed.length > 0) {
      console.log(`[PARSE-CONTACTO] Línea ${lineIndex + 1}: ${trimmed.slice(0, 100)}`);
    }
    
    if (!trimmed.match(/\d{2}-\d{2}-\d{4}/)) {
      if (isDev && trimmed.length > 0) {
        console.log(`[PARSE-CONTACTO] Línea ${lineIndex + 1} no contiene fecha DD-MM-YYYY, saltando`);
      }
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) {
      if (isDev) {
        console.warn(`[PARSE-CONTACTO] Línea ${lineIndex + 1} tiene menos de 4 partes, saltando: ${trimmed.slice(0, 100)}`);
      }
      continue;
    }
    
    if (isDev) {
      console.log(`[PARSE-CONTACTO] ✅ Procesando línea ${lineIndex + 1}`);
    }

    const brand = parts[0];
    const model = parts[1];
    const plate = parts[2];
    const fechaHora = parts.slice(3).join(" ");

    const [datePart, timePart] = fechaHora.split(" ");
    const [dd, mm, yyyy] = datePart.split("-");

    const eventTimestamp = formatLocalTimestamp(
      parseInt(yyyy, 10),
      parseInt(mm, 10),
      parseInt(dd, 10),
      ...timePart.split(":").map(n => parseInt(n, 10))
    );

    events.push({
      type: "contacto",
      eventCategory: "contacto",
      speed: null,
      hasSpeed: false,
      plate: plate.toUpperCase(),
      brand,
      model,
      location: "",
      eventTimestamp,
      severity: "advertencia",
      rawLine: trimmed,
      reason: null
    });

    if (isDev) {
      console.log(`[PARSE-CONTACTO] ✅ Evento parseado: ${plate.toUpperCase()} - Tipo: contacto`);
    }
  }

  if (isDev) {
    console.log(`[PARSE-CONTACTO] Total eventos parseados: ${events.length}`);
    console.log(`[PARSE-CONTACTO] Patentes encontradas:`, events.map(e => e.plate).join(", "));
  }

  return events;
}

/**
 * Mapea salida de cada parser al modelo unificado.
 * @param {object} raw - Evento crudo del parser
 * @param {string} sourceEmailType - "excesos_del_dia" | "no_identificados_del_dia" | "contacto_sin_identificacion"
 * @returns {object} Evento normalizado
 */
function normalizarEvento(raw, sourceEmailType) {
  return {
    type: raw.type ?? "info",
    sourceEmailType: sourceEmailType ?? "excesos_del_dia",
    reason: raw.reason ?? null,
    speed: raw.speed ?? null,
    hasSpeed: raw.hasSpeed ?? false,
    eventTimestamp: raw.eventTimestamp ?? null,
    location: raw.location ?? null,
    plate: raw.plate ?? "",
    brand: raw.brand ?? "",
    model: raw.model ?? "",
    rawLine: raw.rawLine ?? "",
    severity: raw.severity ?? "info",
    timezone: raw.timezone ?? DEFAULT_TIMEZONE,
    eventCategory: raw.eventCategory ?? "exceso_velocidad",
    fecha: raw.fecha ?? null,
    hora: raw.hora ?? null,
    eventDate: raw.eventDate ?? null,
    eventTime: raw.eventTime ?? null,
  };
}

/**
 * Orquesta el parseo según tipo de email detectado.
 * Si no se detecta tipo, intenta todos los parsers y usa el que devuelva más eventos.
 * @param {string} subject - Asunto del email
 * @param {string} bodyText - Cuerpo en texto plano
 * @returns {{ events: Array<object>, sourceEmailType: string|null }}
 */
function parseVehicleEventsFromEmail(subject, bodyText) {
  const sourceEmailType = detectEmailType(subject, bodyText);
  let rawEvents = [];
  let detectedType = sourceEmailType;

  if (sourceEmailType === EMAIL_TYPE_EXCESOS) {
    rawEvents = parseExcesos(bodyText);
  } else if (sourceEmailType === EMAIL_TYPE_NO_IDENTIFICADOS) {
    rawEvents = parseNoIdentificados(bodyText);
  } else if (sourceEmailType === EMAIL_TYPE_CONTACTO) {
    rawEvents = parseContactoSinIdentificacion(bodyText);
  } else {
    // Fallback: intentar todos los parsers y usar el que devuelva más eventos
    console.log(`[PARSE-VEHICLE-EVENTS] ⚠️ Tipo no detectado, intentando todos los parsers...`);
    
    const excesosEvents = parseExcesos(bodyText);
    const noIdEvents = parseNoIdentificados(bodyText);
    const contactoEvents = parseContactoSinIdentificacion(bodyText);
    
    console.log(`[PARSE-VEHICLE-EVENTS] Resultados del fallback:`);
    console.log(`  - Excesos: ${excesosEvents.length} eventos`);
    console.log(`  - No identificados: ${noIdEvents.length} eventos`);
    console.log(`  - Contacto: ${contactoEvents.length} eventos`);
    
    // Usar el parser que devolvió más eventos
    if (excesosEvents.length >= noIdEvents.length && excesosEvents.length >= contactoEvents.length) {
      rawEvents = excesosEvents;
      detectedType = EMAIL_TYPE_EXCESOS;
      console.log(`[PARSE-VEHICLE-EVENTS] ✅ Usando parser: EXCESOS (${excesosEvents.length} eventos)`);
    } else if (noIdEvents.length >= contactoEvents.length) {
      rawEvents = noIdEvents;
      detectedType = EMAIL_TYPE_NO_IDENTIFICADOS;
      console.log(`[PARSE-VEHICLE-EVENTS] ✅ Usando parser: NO_IDENTIFICADOS (${noIdEvents.length} eventos)`);
    } else {
      rawEvents = contactoEvents;
      detectedType = EMAIL_TYPE_CONTACTO;
      console.log(`[PARSE-VEHICLE-EVENTS] ✅ Usando parser: CONTACTO (${contactoEvents.length} eventos)`);
    }
  }

  // Usar detectedType en lugar de sourceEmailType para el fallback
  const sourceEmailTypeKey =
    detectedType === EMAIL_TYPE_EXCESOS
      ? "excesos_del_dia"
      : detectedType === EMAIL_TYPE_NO_IDENTIFICADOS
        ? "no_identificados_del_dia"
        : detectedType === EMAIL_TYPE_CONTACTO
          ? "contacto_sin_identificacion"
          : "excesos_del_dia";

  const events = rawEvents.map((raw) => normalizarEvento(raw, sourceEmailTypeKey));

  // Validación: coherencia entre sourceEmailType y tipos de eventos
  const expectedTypes = {
    [EMAIL_TYPE_CONTACTO]: ["contacto"],
    [EMAIL_TYPE_NO_IDENTIFICADOS]: ["no_identificado"],
    [EMAIL_TYPE_EXCESOS]: ["exceso", "sin_llave", "llave_no_registrada", "conductor_inactivo"],
  };
  if (detectedType && expectedTypes[detectedType]) {
    const allowed = new Set(expectedTypes[detectedType]);
    const incoherent = events.filter((e) => !e.type || !allowed.has(e.type));
    if (incoherent.length > 0) {
      console.warn(
        `[PARSE-VEHICLE-EVENTS] ⚠️ Incoherencia: email tipo ${detectedType} pero ${incoherent.length} evento(s) con type no esperado:`,
        incoherent.map((e) => e.type)
      );
    }
  }

  // Logs críticos para debugging
  console.log("🔍 [PARSE-VEHICLE-EVENTS] TOTAL EVENTS PARSED:", events.length);
  console.log("🔍 [PARSE-VEHICLE-EVENTS] PLATES:", events.map(e => e.plate));
  console.log("🔍 [PARSE-VEHICLE-EVENTS] Source Email Type (detectado):", detectedType);
  console.log("🔍 [PARSE-VEHICLE-EVENTS] Source Email Type (original):", sourceEmailType);

  return { events, sourceEmailType: detectedType };
}

/**
 * Devuelve los patrones de asunto usados para detectar tipo de email.
 * Útil para tests y documentación de variantes (acentos, "día"/"dia").
 * @returns {{ excesos: RegExp, no_identificados: RegExp, contacto: RegExp }}
 */
function getSubjectPatterns() {
  return { ...SUBJECT_PATTERNS };
}

module.exports = {
  parseLine,
  parseVehicleEventsFromBody,
  parseExcesos,
  parseNoIdentificados,
  parseContactoSinIdentificacion,
  parseVehicleEventsFromEmail,
  normalizarEvento,
  detectEmailType,
  getSubjectPatterns,
  DEFAULT_TIMEZONE,
  EMAIL_TYPE_EXCESOS,
  EMAIL_TYPE_NO_IDENTIFICADOS,
  EMAIL_TYPE_CONTACTO,
};
