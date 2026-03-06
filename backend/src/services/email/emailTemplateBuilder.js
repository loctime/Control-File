/**
 * Generador de plantillas HTML para emails de alertas diarias.
 * UTF-8, estilos inline únicamente, max-width 640px, compatible Gmail/Outlook.
 * Iconos: 🚗 vehículo, ⚠ alerta, 📊 métricas, 📡 contacto, 🔑 llave, 🪪 no identificado.
 */

const ICONS = {
  vehicle: "🚗",
  alert: "⚠",
  metrics: "📊",
  contact: "📡",
  key: "🔑",
  noIdentificado: "🪪",
};

/**
 * Escapa caracteres HTML para prevenir inyección.
 */
function escapeHtml(text) {
  if (!text || typeof text !== "string") return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Formatea fecha/hora en formato argentino (DD/MM/YYYY HH:mm).
 * Compatible con Firestore Timestamp e ISO con offset.
 */
function formatDateTimeArgentina(timestamp) {
  if (!timestamp) return "-";
  try {
    if (timestamp && typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      if (isNaN(date.getTime())) return "-";
      return date
        .toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Argentina/Buenos_Aires",
        })
        .replace(/,/g, "");
    }
    const str = typeof timestamp === "string" ? timestamp.trim() : String(timestamp);
    const isoMatch = str.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:[.]\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i
    );
    if (isoMatch) {
      const [, y, m, d, hh, mm] = isoMatch;
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "-";
    return date
      .toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Argentina/Buenos_Aires",
      })
      .replace(/,/g, "");
  } catch {
    return "-";
  }
}

/**
 * Mapea type del evento a etiqueta legible para el email (UTF-8).
 */
function getTypeLabel(e) {
  switch (e.type) {
    case "sin_llave":
      return "SIN LLAVE";
    case "llave_no_registrada":
      return "Llave no registrada";
    case "conductor_inactivo":
      return "Conductor inactivo";
    case "no_identificado":
      return "No identificado";
    case "contacto":
      return "Contacto sin identificación";
    default:
      return "Exceso de velocidad";
  }
}

function getSeverityColor() {
  return "#b91c1c";
}

/**
 * Métricas por tipo desde meta del día.
 */
function getMetricsByTypeFromMeta(meta) {
  if (!meta) {
    return {
      excesos: 0,
      no_identificados: 0,
      contactos: 0,
      llave_sin_cargar: 0,
      conductor_inactivo: 0,
    };
  }
  return {
    excesos: meta.totalExcesos ?? 0,
    no_identificados: meta.totalNoIdentificados ?? 0,
    contactos: meta.totalContactos ?? 0,
    llave_sin_cargar: meta.totalLlaveSinCargar ?? 0,
    conductor_inactivo: meta.totalConductorInactivo ?? 0,
  };
}

/**
 * Genera meta a partir de documentos de vehículos (totales por tipo).
 * Exportado para uso en rutas.
 */
function buildMetaFromVehicleDocs(vehicleDocs) {
  if (!Array.isArray(vehicleDocs) || vehicleDocs.length === 0) {
    return {
      totalVehicles: 0,
      totalEvents: 0,
      vehiclesWithCritical: 0,
      totalExcesos: 0,
      totalNoIdentificados: 0,
      totalContactos: 0,
      totalLlaveSinCargar: 0,
      totalConductorInactivo: 0,
    };
  }
  let totalEvents = 0;
  let vehiclesWithCritical = 0;
  const byType = {
    excesos: 0,
    no_identificados: 0,
    contactos: 0,
    llave_sin_cargar: 0,
    conductor_inactivo: 0,
  };
  for (const doc of vehicleDocs) {
    const events = Array.isArray(doc.events) ? doc.events : [];
    const n = events.length;
    totalEvents += n;
    if (n > 0) vehiclesWithCritical += 1;
    const s = doc.summary || {};
    byType.excesos += s.excesos ?? 0;
    byType.no_identificados += s.no_identificados ?? 0;
    byType.contactos += s.contactos ?? 0;
    byType.llave_sin_cargar += s.llave_sin_cargar ?? 0;
    byType.conductor_inactivo += s.conductor_inactivo ?? 0;
  }
  return {
    totalVehicles: vehicleDocs.length,
    totalEvents,
    vehiclesWithCritical,
    totalExcesos: byType.excesos,
    totalNoIdentificados: byType.no_identificados,
    totalContactos: byType.contactos,
    totalLlaveSinCargar: byType.llave_sin_cargar,
    totalConductorInactivo: byType.conductor_inactivo,
  };
}

/**
 * Ordena documentos por criticidad (riskScore desc, luego patente).
 * Exportado para uso en rutas.
 */
function sortVehiclesByCriticity(docs) {
  if (!Array.isArray(docs) || docs.length <= 1) return docs;
  return [...docs].sort((a, b) => {
    const scoreA = typeof a.riskScore === "number" ? a.riskScore : 0;
    const scoreB = typeof b.riskScore === "number" ? b.riskScore : 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const plateA = (a.plate || a.id || "").toString();
    const plateB = (b.plate || b.id || "").toString();
    return plateA.localeCompare(plateB);
  });
}

/**
 * Encabezado global del email: título, fecha y resumen de métricas (UTF-8).
 */
function buildGlobalSummaryHeader(meta, dateKey) {
  const totalVehicles = meta ? meta.totalVehicles ?? 0 : 0;
  const totalEvents = meta ? meta.totalEvents ?? 0 : 0;
  const vehiclesWithCritical = meta ? meta.vehiclesWithCritical ?? 0 : 0;
  const byType = getMetricsByTypeFromMeta(meta);

  const hasByType =
    byType.excesos > 0 ||
    byType.no_identificados > 0 ||
    byType.contactos > 0 ||
    byType.llave_sin_cargar > 0 ||
    byType.conductor_inactivo > 0;

  const metricsByTypeHtml = hasByType
    ? `<div style="font-size:13px;margin-top:10px;padding-top:10px;border-top:1px solid #93c5fd;">
        <strong>Por tipo:</strong>
        ${byType.excesos > 0 ? ` ${ICONS.alert} Excesos de velocidad: ${byType.excesos}` : ""}
        ${byType.no_identificados > 0 ? ` | ${ICONS.noIdentificado} No identificados: ${byType.no_identificados}` : ""}
        ${byType.contactos > 0 ? ` | ${ICONS.contact} Contacto sin identificación: ${byType.contactos}` : ""}
        ${byType.llave_sin_cargar > 0 ? ` | ${ICONS.key} Llave sin cargar: ${byType.llave_sin_cargar}` : ""}
        ${byType.conductor_inactivo > 0 ? ` | Conductor inactivo: ${byType.conductor_inactivo}` : ""}
      </div>`
    : "";

  return `
  <div style="background:#1f2937;color:#fff;padding:20px;border-radius:6px 6px 0 0;">
    <div style="font-size:20px;font-weight:600;">${ICONS.vehicle} Alertas de flota</div>
    <div style="font-size:13px;opacity:0.9;margin-top:4px;">Resumen diario — ${escapeHtml(dateKey)}</div>
  </div>
  <div style="background:#eff6ff;padding:16px;border:1px solid #bfdbfe;border-top:none;">
    <div style="font-size:14px;line-height:1.6;">
      <strong>Vehículos con alertas:</strong> ${totalVehicles} &nbsp;|&nbsp;
      <strong>Total eventos:</strong> ${totalEvents}
      ${vehiclesWithCritical > 0 ? ` &nbsp;|&nbsp; <span style="color:#b91c1c;font-weight:600;">${ICONS.alert} Vehículos con eventos: ${vehiclesWithCritical}</span>` : ""}
    </div>
    ${totalEvents > 0 ? `<div style="font-size:13px;margin-top:8px;color:#1e40af;">${ICONS.alert} ${totalEvents} eventos</div>` : ""}
    ${metricsByTypeHtml}
  </div>`;
}

/**
 * Sección HTML por vehículo: patente, marca/modelo, resumen por tipo, tabla de eventos (UTF-8).
 */
function buildVehicleSection(doc) {
  const { plate, brand, model, events, summary } = doc;
  if (!Array.isArray(events) || events.length === 0) {
    return `<div style="margin-top:16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <div style="background:#f9fafb;padding:10px 12px;font-weight:600;font-size:14px;">${ICONS.vehicle} ${escapeHtml(plate)}</div>
      <div style="padding:12px;font-size:13px;color:#6b7280;">Sin eventos.</div>
    </div>`;
  }

  const sortedEvents = events
    .filter((e) => e && e.eventTimestamp)
    .sort((a, b) => new Date(b.eventTimestamp) - new Date(a.eventTimestamp));
  const totalEventos = sortedEvents.length;
  const summaryByType = summary || {};
  const color = getSeverityColor();

  const rowsHtml = sortedEvents
    .map((e) => {
      let typeLabel;
      const hasReason = e.reason && typeof e.reason === "string" && e.reason.trim().length > 0;
      const hasDriver = e.driverName && typeof e.driverName === "string" && e.driverName.trim().length > 0;
      if (hasReason || hasDriver) {
        const parts = [];
        if (hasReason) parts.push(e.reason.trim());
        if (hasDriver) parts.push(e.driverName.trim());
        typeLabel = parts.join(" - ") + (e.speed != null && e.hasSpeed ? " - Exceso de velocidad" : "");
      } else {
        typeLabel = getTypeLabel(e);
      }
      return `
    <tr>
      <td style="padding:6px 8px;font-weight:600;color:${color};font-size:12px;">${escapeHtml(typeLabel)}</td>
      <td style="padding:6px 8px;font-size:12px;">${e.speed != null ? e.speed + " km/h" : "-"}</td>
      <td style="padding:6px 8px;font-size:12px;">${formatDateTimeArgentina(e.eventTimestamp)}</td>
      <td style="padding:6px 8px;font-size:12px;">${escapeHtml(e.locationRaw || e.location || "Sin ubicación")}</td>
    </tr>`;
    })
    .join("");

  const typeSummaryParts = [];
  if (summaryByType.excesos > 0) typeSummaryParts.push(`Excesos: ${summaryByType.excesos}`);
  if (summaryByType.no_identificados > 0) typeSummaryParts.push(`No identificados: ${summaryByType.no_identificados}`);
  if (summaryByType.contactos > 0) typeSummaryParts.push(`Contactos: ${summaryByType.contactos}`);
  if (summaryByType.llave_sin_cargar > 0) typeSummaryParts.push(`Llave sin cargar: ${summaryByType.llave_sin_cargar}`);
  if (summaryByType.conductor_inactivo > 0) typeSummaryParts.push(`Conductor inactivo: ${summaryByType.conductor_inactivo}`);
  const typeSummaryHtml =
    typeSummaryParts.length > 0
      ? `<div style="font-size:11px;margin-bottom:8px;color:#4b5563;">${typeSummaryParts.join(" | ")}</div>`
      : "";

  return `
  <div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <div style="background:#fafafa;padding:10px 12px;font-weight:600;font-size:14px;border-bottom:1px solid #e5e7eb;">
      ${ICONS.vehicle} ${escapeHtml(plate)} – ${escapeHtml(brand || "")} ${escapeHtml(model || "")}
      <span style="color:#b91c1c;margin-left:8px;font-size:13px;">${ICONS.alert} ${totalEventos} ${totalEventos === 1 ? "evento" : "eventos"}</span>
    </div>
    ${typeSummaryHtml}
    <table style="width:100%;border-collapse:collapse;font-size:12px;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;">Tipo</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;">Velocidad</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;">Fecha/Hora</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;">Ubicación</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;
}

/**
 * Cuerpo consolidado: encabezado global + secciones por vehículo. Max-width 640px, estilos inline.
 */
function buildConsolidatedBody(meta, vehicleDocs, dateKey) {
  const sections = vehicleDocs.map((doc) => buildVehicleSection(doc)).join("");
  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen diario de flota — ${escapeHtml(dateKey)}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:16px;background:#fff;color:#111;">
  ${buildGlobalSummaryHeader(meta, dateKey)}
  ${sections}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#6b7280;font-size:12px;">Sistema ControlFlota · Resumen generado el ${today}</p>
  </div>
</body>
</html>`.trim();
}

/**
 * Cuerpo del email general por grupos operativos (todas las operaciones en un solo HTML).
 */
function buildGeneralGroupsBody(groups, dateKey) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Resumen general — ${escapeHtml(dateKey)}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:24px;">
    <h2 style="font-size:18px;color:#374151;">No hay alertas pendientes.</h2>
  </div>
</body>
</html>`.trim();
  }

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const sections = groups
    .map((group) => {
      const sortedDocs = sortVehiclesByCriticity(group.docs);
      const meta = buildMetaFromVehicleDocs(sortedDocs);
      const operationName = (
        sortedDocs[0]?.operationName ||
        sortedDocs[0]?.operacion ||
        "Operación no asignada"
      ).toUpperCase();
      const responsablesText = (group.responsableEmails || []).join(", ");

      return `
  <div style="margin-top:24px;border-top:2px solid #1f2937;padding-top:12px;">
    <h2 style="margin:0;font-size:16px;color:#111;font-weight:600;">
      ${ICONS.metrics} Operación ${escapeHtml(operationName)}
    </h2>
    <div style="font-size:12px;color:#4b5563;margin:6px 0 12px 0;">
      Responsables: ${escapeHtml(responsablesText)}<br>
      Vehículos con eventos: ${meta.totalVehicles} | Total eventos: ${meta.totalEvents}
    </div>
  </div>
  ${sortedDocs.map((doc) => buildVehicleSection(doc)).join("")}`.trim();
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen general de operaciones — ${escapeHtml(dateKey)}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#fff;color:#111;">

  <div style="background:#1f2937;color:#fff;padding:20px;border-radius:6px 6px 0 0;">
    <div style="font-size:20px;font-weight:600;">${ICONS.metrics} Resumen general de operaciones</div>
    <div style="font-size:13px;opacity:0.9;margin-top:4px;">${escapeHtml(dateKey)}</div>
  </div>

  ${sections}

  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#6b7280;">Sistema ControlFlota · Resumen generado el ${today}</p>
  </div>

</body>
</html>`.trim();
}

/**
 * Asunto del email consolidado por día (UTF-8).
 */
function buildConsolidatedSubject(dateKey) {
  return `${ICONS.vehicle} Resumen diario de flota — ${dateKey}`;
}

/**
 * Asunto del email general (últimos N días).
 */
function buildGeneralSubjectLastDays(days) {
  return `${ICONS.metrics} Resumen general de operaciones (últimos ${days} días)`;
}

/**
 * Asunto del email general (una sola fecha).
 */
function buildGeneralSubjectSingleDate(dateKey) {
  return `${ICONS.metrics} Resumen general de operaciones — ${dateKey}`;
}

module.exports = {
  buildConsolidatedBody,
  buildVehicleSection,
  buildGlobalSummaryHeader,
  buildGeneralGroupsBody,
  buildConsolidatedSubject,
  buildGeneralSubjectLastDays,
  buildGeneralSubjectSingleDate,
  buildMetaFromVehicleDocs,
  sortVehiclesByCriticity,
};
