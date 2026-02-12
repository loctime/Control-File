/**
 * vehicleEventParser.js
 * Parsea líneas de telemetría de velocidad desde body_text de emails.
 * Formato esperado: "132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ..."
 */

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_OFFSET = "-03:00";

const isDev = process.env.NODE_ENV !== "production";

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
 * Ignora líneas corruptas sin romper el flujo.
 * @param {string} bodyText - Cuerpo del email en texto plano
 * @returns {Array<object>} Array de objetos evento
 */
function parseVehicleEventsFromBody(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const lines = bodyText.split(/\r?\n/);
  const events = [];

  for (const line of lines) {
    try {
      const event = parseLine(line);
      if (event) events.push(event);
    } catch (err) {
      if (isDev) console.log("[VEHICLE-PARSER] Error parseando línea (ignorada):", err.message);
    }
  }

  return events;
}

module.exports = {
  parseLine,
  parseVehicleEventsFromBody,
  DEFAULT_TIMEZONE,
};
