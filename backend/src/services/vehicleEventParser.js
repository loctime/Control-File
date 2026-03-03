/**
 * Parsers determinísticos por formato de email de flota.
 */

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_OFFSET = "-03:00";

const EMAIL_TYPE_EXCESOS = "excesos";
const EMAIL_TYPE_NO_IDENTIFICADOS = "no_identificados";
const EMAIL_TYPE_CONTACTO = "contacto";

const SUBJECT_PATTERNS = {
  excesos: /excesos?\s+(del\s+)?d[íi]a/i,
  no_identificados: /no\s+identificados?\s+(del\s+)?d[íi]a/i,
  contacto: /contacto\s+sin\s+identificaci[oó]n\s+(del\s+)?d[íi]a/i,
};

function normalizePlate(plate) {
  if (!plate || typeof plate !== "string") return "";
  return plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function formatLocalTimestamp(year, month, day, hh, min, ss) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(ss).padStart(2, "0")}${ARGENTINA_OFFSET}`;
}

function parseDateTimeToIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  let day;
  let month;
  let year;

  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const [dd, mm, yy] = dateStr.split("/").map((v) => parseInt(v, 10));
    day = dd;
    month = mm;
    year = 2000 + yy;
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("-").map((v) => parseInt(v, 10));
    day = dd;
    month = mm;
    year = yyyy;
  } else {
    return null;
  }

  const [hh, min, ss] = timeStr.split(":").map((v) => parseInt(v, 10));
  if ([day, month, year, hh, min, ss].some((n) => Number.isNaN(n))) return null;
  return formatLocalTimestamp(year, month, day, hh, min, ss);
}

function classifyTypeFromReason(reason) {
  const r = String(reason || "");
  if (/llave\s+sin\s+cargar/i.test(r)) return "llave_no_registrada";
  if (/conductor\s+inactivo/i.test(r)) return "conductor_inactivo";
  if (/sin\s+llave/i.test(r)) return "sin_llave";
  return "no_identificado";
}

function extractLocation(restText) {
  const locationRegex = /\b(RP\s*\d+|RN\s*\d+|DESCONOCIDO|RUTA|AV\.?|CALLE|KM)\b/i;
  const match = restText.match(locationRegex);
  if (!match || match.index == null) {
    return { descriptor: restText.trim(), locationRaw: null, locationShort: null };
  }

  const descriptor = restText.slice(0, match.index).trim();
  const locationRaw = restText.slice(match.index).trim();
  const shortMatch = locationRaw.match(/\b(RP\s*\d+|RN\s*\d+)\b/i) || locationRaw.match(/\b(DESCONOCIDO)\b/i);
  const locationShort = shortMatch ? shortMatch[1].replace(/\s+/g, "").toUpperCase() : null;

  return {
    descriptor,
    locationRaw,
    locationShort: locationShort === "DESCONOCIDO" ? "Desconocido" : locationShort,
  };
}

function parseBrandModelDriverAndKey(descriptor) {
  const text = String(descriptor || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return { brand: "", model: "", driverName: null, keyId: null };
  }

  const parenKeyMatch = text.match(/\(([A-Z0-9]{5,})\)/i);
  let keyId = parenKeyMatch ? parenKeyMatch[1].toUpperCase() : null;

  let baseText = text.replace(/\([^)]+\)/g, " ").replace(/\s+/g, " ").trim();
  let tokens = baseText.split(" ").filter(Boolean);

  if (!keyId) {
    const idx = tokens.findIndex((token) => /^[0-9A-F]{6,}$/i.test(token));
    if (idx >= 0) {
      keyId = tokens[idx].toUpperCase();
      tokens.splice(idx, 1);
    }
  } else {
    tokens = tokens.filter((token) => token.toUpperCase() !== keyId);
  }

  const brand = tokens[0] || "";
  let modelTokens = tokens.slice(1);
  let driverName = null;

  // Solo capturar driverName si hay keyId y sufijo claramente nominal (>=2 palabras mayúsculas alfabéticas)
  if (keyId && modelTokens.length >= 3) {
    const suffix = [];
    for (let i = modelTokens.length - 1; i >= 0; i--) {
      const token = modelTokens[i];
      const isNameWord = /^[A-ZÁÉÍÓÚÑ]+$/u.test(token);
      if (isNameWord) {
        suffix.unshift(token);
      } else {
        break;
      }
    }

    if (suffix.length >= 2 && suffix.length < modelTokens.length) {
      driverName = suffix.join(" ");
      modelTokens = modelTokens.slice(0, modelTokens.length - suffix.length);
    }
  }

  return {
    brand,
    model: modelTokens.join(" "),
    driverName,
    keyId,
  };
}

function detectEmailType(subject) {
  if (!subject || typeof subject !== "string") return null;
  const s = subject.trim();
  if (!s) return null;

  const normalized = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");

  if (SUBJECT_PATTERNS.contacto.test(s) || /contacto\s+sin\s+identific/i.test(normalized)) {
    return EMAIL_TYPE_CONTACTO;
  }
  if (
    SUBJECT_PATTERNS.no_identificados.test(s) ||
    /no\s+identific/i.test(normalized) ||
    /falta\s+(de\s+)?identific/i.test(normalized) ||
    /sin\s+identific/i.test(normalized)
  ) {
    return EMAIL_TYPE_NO_IDENTIFICADOS;
  }
  if (SUBJECT_PATTERNS.excesos.test(s) || /exceso/i.test(normalized) || /velocidad/i.test(normalized)) {
    return EMAIL_TYPE_EXCESOS;
  }

  return null;
}

function buildCommonEvent(raw) {
  const plateRaw = raw.plate || "";
  const plateNormalized = normalizePlate(plateRaw);
  return {
    type: raw.type,
    speed: raw.speed ?? null,
    hasSpeed: Boolean(raw.hasSpeed),
    plate: plateRaw,
    plateNormalized,
    brand: raw.brand || "",
    model: raw.model || "",
    driverName: raw.driverName ?? null,
    keyId: raw.keyId ?? null,
    locationShort: raw.locationShort ?? null,
    locationRaw: raw.locationRaw ?? null,
    // compatibilidad
    location: raw.locationShort ?? raw.locationRaw ?? "",
    eventTimestamp: raw.eventTimestamp || null,
    severity: "critico",
    timezone: DEFAULT_TIMEZONE,
    rawLine: raw.rawLine || "",
  };
}

function parseExcesos(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const regex = /^(\d+)\s*Km\/h\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s*-\s+(.+)$/i;

  return bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(regex);
      if (!match) return null;

      const speed = parseInt(match[1], 10);
      const eventTimestamp = parseDateTimeToIso(match[2], match[3]);
      const plateRaw = match[4].trim();
      const rest = match[5].trim();

      const { descriptor, locationRaw, locationShort } = extractLocation(rest);
      const parsed = parseBrandModelDriverAndKey(descriptor);
      const type = classifyTypeFromReason(rest);

      return buildCommonEvent({
        type: type === "no_identificado" ? "exceso" : type,
        speed,
        hasSpeed: true,
        plate: plateRaw,
        brand: parsed.brand,
        model: parsed.model,
        driverName: parsed.driverName,
        keyId: parsed.keyId,
        locationShort,
        locationRaw,
        eventTimestamp,
        rawLine: line,
      });
    })
    .filter(Boolean);
}

function parseNoIdentificados(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  return bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const prefixMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/i);
      if (!prefixMatch) return null;
      const [, datePart, timePart, restAfterTime] = prefixMatch;
      const reasonMatch = restAfterTime.match(/\(([^()]+)\)\s*$/);
      if (!reasonMatch) return null;

      const reason = reasonMatch[1];
      const beforeReason = restAfterTime.slice(0, reasonMatch.index).trim();
      const separatorIdx = beforeReason.lastIndexOf(" - ");
      if (separatorIdx <= 0) return null;
      const plateRaw = beforeReason.slice(0, separatorIdx).trim();
      const vehiclePart = beforeReason.slice(separatorIdx + 3).trim();

      const eventTimestamp = parseDateTimeToIso(datePart, timePart);
      const [brand = "", ...modelParts] = vehiclePart.trim().split(/\s+/);
      const reasonText = reason.trim();
      const type = classifyTypeFromReason(reasonText);
      const keyIdMatch = reasonText.match(/llave\s+sin\s+cargar\s*:\s*([A-Z0-9]+)/i) || reasonText.match(/^([A-Z0-9]{5,})$/i);

      return buildCommonEvent({
        type,
        speed: null,
        hasSpeed: false,
        plate: plateRaw,
        brand,
        model: modelParts.join(" "),
        keyId: keyIdMatch ? keyIdMatch[1].toUpperCase() : null,
        locationShort: null,
        locationRaw: null,
        eventTimestamp,
        rawLine: line,
      });
    })
    .filter(Boolean);
}

function parseContactoSinIdentificacion(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return [];

  const regex = /^(.*?)\s{2,}(.*?)\s{2,}([A-Z0-9\-\s]+?)\s{2,}(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})$/i;

  return bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(regex);
      if (!match) return null;

      const [, brand, model, plateRaw, datePart, timePart] = match;
      const eventTimestamp = parseDateTimeToIso(datePart, timePart);

      return buildCommonEvent({
        type: "contacto",
        speed: null,
        hasSpeed: false,
        plate: plateRaw,
        brand: brand.trim(),
        model: model.trim(),
        locationShort: null,
        locationRaw: null,
        eventTimestamp,
        rawLine: line,
      });
    })
    .filter(Boolean);
}

function normalizarEvento(raw, sourceEmailType) {
  return {
    ...raw,
    sourceEmailType: sourceEmailType ?? "excesos_del_dia",
    reason: raw.reason ?? null,
    eventCategory: raw.hasSpeed ? "exceso_velocidad" : raw.type,
    fecha: null,
    hora: null,
    eventDate: null,
    eventTime: null,
  };
}

function parseVehicleEventsFromEmail(subject, bodyText) {
  const sourceEmailType = detectEmailType(subject);
  let rawEvents = [];
  let detectedType = sourceEmailType;

  if (sourceEmailType === EMAIL_TYPE_EXCESOS) {
    rawEvents = parseExcesos(bodyText);
  } else if (sourceEmailType === EMAIL_TYPE_NO_IDENTIFICADOS) {
    rawEvents = parseNoIdentificados(bodyText);
  } else if (sourceEmailType === EMAIL_TYPE_CONTACTO) {
    rawEvents = parseContactoSinIdentificacion(bodyText);
  } else {
    const excesos = parseExcesos(bodyText);
    const noIds = parseNoIdentificados(bodyText);
    const contactos = parseContactoSinIdentificacion(bodyText);
    if (excesos.length >= noIds.length && excesos.length >= contactos.length) {
      rawEvents = excesos;
      detectedType = EMAIL_TYPE_EXCESOS;
    } else if (noIds.length >= contactos.length) {
      rawEvents = noIds;
      detectedType = EMAIL_TYPE_NO_IDENTIFICADOS;
    } else {
      rawEvents = contactos;
      detectedType = EMAIL_TYPE_CONTACTO;
    }
  }

  const sourceEmailTypeKey =
    detectedType === EMAIL_TYPE_EXCESOS
      ? "excesos_del_dia"
      : detectedType === EMAIL_TYPE_NO_IDENTIFICADOS
        ? "no_identificados_del_dia"
        : detectedType === EMAIL_TYPE_CONTACTO
          ? "contacto_sin_identificacion"
          : "excesos_del_dia";

  return {
    events: rawEvents.map((raw) => normalizarEvento(raw, sourceEmailTypeKey)),
    sourceEmailType: detectedType,
  };
}

function parseVehicleEventsFromBody(bodyText, subject = "") {
  return parseVehicleEventsFromEmail(subject, bodyText || "").events;
}

function parseLine(line) {
  const events = parseExcesos(String(line || ""));
  return events[0] || null;
}

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
