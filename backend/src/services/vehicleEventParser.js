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
 * @param {string} subject - Asunto del email
 * @param {string} [bodyText] - Cuerpo en texto plano (opcional)
 * @returns {string|null} "excesos" | "no_identificados" | "contacto" | null
 */
function detectEmailType(subject, bodyText) {
  if (!subject || typeof subject !== "string") return null;
  const s = subject.trim();
  if (s.length === 0) return null;
  if (SUBJECT_PATTERNS.excesos.test(s)) return EMAIL_TYPE_EXCESOS;
  if (SUBJECT_PATTERNS.no_identificados.test(s)) return EMAIL_TYPE_NO_IDENTIFICADOS;
  if (SUBJECT_PATTERNS.contacto.test(s)) return EMAIL_TYPE_CONTACTO;
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().includes("km/h")) continue;

    const regex =
      /(\d+)\s+km\/h\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9\-\s]+?)\s+-\s+(.+)/i;

    const match = trimmed.match(regex);
    if (!match) continue;

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
    const { brand, model, location } = parseBrandModelLocation(rest);

    // ---- CLASIFICACIÓN INTELIGENTE ----
    let type = "exceso";
    let severity = "info";
    let reason = null;

    if (/\(sin llave\)/i.test(rest)) {
      type = "sin_llave";
      severity = "critico";
      reason = "SIN_LLAVE";
    } else if (/\(llave sin cargar/i.test(rest)) {
      type = "llave_no_registrada";
      severity = "advertencia";
      reason = "LLAVE_NO_REGISTRADA";
    } else if (/\(conductor inactivo/i.test(rest)) {
      type = "conductor_inactivo";
      severity = "advertencia";
      reason = "CONDUCTOR_INACTIVO";
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.match(/\d{2}\/\d{2}\/\d{2}/)) continue;

    const regex =
      /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9\-]+)\s+-\s+(.+)\((.+)\)/i;

    const match = trimmed.match(regex);
    if (!match) continue;

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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.match(/\d{2}-\d{2}-\d{4}/)) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;

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
      reason: "CONTACTO_SIN_IDENTIFICACION"
    });
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
 * @param {string} subject - Asunto del email
 * @param {string} bodyText - Cuerpo en texto plano
 * @returns {{ events: Array<object>, sourceEmailType: string|null }}
 */
function parseVehicleEventsFromEmail(subject, bodyText) {
  const sourceEmailType = detectEmailType(subject, bodyText);
  let rawEvents = [];

  if (sourceEmailType === EMAIL_TYPE_EXCESOS) {
    rawEvents = parseExcesos(bodyText);
  } else if (sourceEmailType === EMAIL_TYPE_NO_IDENTIFICADOS) {
    rawEvents = parseNoIdentificados(bodyText);
  } else if (sourceEmailType === EMAIL_TYPE_CONTACTO) {
    rawEvents = parseContactoSinIdentificacion(bodyText);
  } else {
    // Fallback: intentar parseExcesos para compatibilidad
    rawEvents = parseExcesos(bodyText);
  }

  const sourceEmailTypeKey =
    sourceEmailType === EMAIL_TYPE_EXCESOS
      ? "excesos_del_dia"
      : sourceEmailType === EMAIL_TYPE_NO_IDENTIFICADOS
        ? "no_identificados_del_dia"
        : sourceEmailType === EMAIL_TYPE_CONTACTO
          ? "contacto_sin_identificacion"
          : "excesos_del_dia";

  const events = rawEvents.map((raw) => normalizarEvento(raw, sourceEmailTypeKey));
  return { events, sourceEmailType };
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
  DEFAULT_TIMEZONE,
  EMAIL_TYPE_EXCESOS,
  EMAIL_TYPE_NO_IDENTIFICADOS,
  EMAIL_TYPE_CONTACTO,
};
