/**
 * vehicleEventParser.js
 * Parsea líneas de telemetría de velocidad desde body_text de emails.
 * Formato esperado: "132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ..."
 */

/**
 * Parsea una línea que contiene "Km/h" y extrae los datos del evento.
 * @param {string} line - Línea de texto
 * @returns {object|null} Objeto evento o null si no es válida
 */
function parseLine(line) {
  if (!line || typeof line !== "string") return null;

  const trimmed = line.trim();
  if (!trimmed.includes("Km/h")) return null;

  // Patrón: 132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ...
  // Grupos: speed, fecha (dd/mm/yy), hora, plate, brandModelLocation
  const regex =
    /(\d+)\s+Km\/h\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9\-\s]+?)\s+-\s+(.+)/i;
  const match = trimmed.match(regex);
  if (!match) return null;

  const [, speedStr, fechaStr, horaStr, plateRaw, brandModelRest] = match;
  const speed = parseInt(speedStr, 10);
  if (isNaN(speed) || speed <= 0) return null;

  // Parsear fecha dd/mm/yy y hora
  const [dd, mm, yy] = fechaStr.split("/").map((n) => parseInt(n, 10));
  const [hh, min, ss] = horaStr.split(":").map((n) => parseInt(n, 10));
  const fullYear = yy >= 0 && yy <= 99 ? 2000 + yy : yy;
  const monthIndex = mm - 1;

  const eventDate = new Date(fullYear, monthIndex, dd, hh, min, ss);
  if (isNaN(eventDate.getTime())) return null;

  const eventTimestamp = eventDate.toISOString();
  const eventDateStr = `${String(dd).padStart(2, "0")}/${String(mm).padStart(
    2,
    "0"
  )}/${yy}`;
  const eventTimeStr = horaStr;

  // Plate: normalizar espacios
  const plate = plateRaw.replace(/\s+/g, " ").trim();
  if (!plate) return null;

  // Brand, model, location: primera palabra = brand, segunda = model, resto = location
  const parts = brandModelRest.trim().split(/\s+/).filter(Boolean);
  const brand = parts[0] || "";
  const model = parts[1] || "";
  const location = parts.length > 2 ? parts.slice(2).join(" ") : "";

  // Severity según velocidad
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
    location: location.replace(/^\.\.\.|\.\.\.$/g, "").trim(),
    eventTimestamp,
    eventDate: eventDateStr,
    eventTime: eventTimeStr,
    eventCategory: "exceso_velocidad",
    severity,
    rawLine: trimmed,
  };
}

/**
 * Parsea body_text y devuelve array de eventos listos para persistir.
 * @param {string} bodyText - Cuerpo del email en texto plano
 * @returns {Array<object>} Array de objetos evento
 */
function parseVehicleEventsFromBody(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const lines = bodyText.split(/\r?\n/);
  const events = [];

  for (const line of lines) {
    const event = parseLine(line);
    if (event) events.push(event);
  }

  return events;
}

module.exports = {
  parseLine,
  parseVehicleEventsFromBody,
};
