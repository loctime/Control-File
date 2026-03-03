const {
  detectEmailType,
  parseExcesos,
  parseNoIdentificados,
  parseContactoSinIdentificacion,
  parseVehicleEventsFromEmail,
  EMAIL_TYPE_EXCESOS,
  EMAIL_TYPE_NO_IDENTIFICADOS,
  EMAIL_TYPE_CONTACTO,
} = require("../vehicleEventParser");

describe("vehicleEventParser - formatos reales", () => {
  it("detecta tipo de email por subject", () => {
    expect(detectEmailType("Excesos del día")).toBe(EMAIL_TYPE_EXCESOS);
    expect(detectEmailType("No identificados del día")).toBe(EMAIL_TYPE_NO_IDENTIFICADOS);
    expect(detectEmailType("Contacto sin identificación del día.")).toBe(EMAIL_TYPE_CONTACTO);
  });

  it("parsea No identificados del día y captura keyId cuando existe", () => {
    const body = `No identificados del día
02/03/26 01:44:19 AG-628-GV - Ford Ranger (Llave sin cargar: 1F9C521)
02/03/26 07:27:42 AG-676-NJ - Ford Ranger (Llave sin cargar: 12EC248)
02/03/26 07:44:01 AF-999-DU - Renault Kangoo (No identificado)
02/03/26 18:08:24 AF-990-OE - Ford Ranger (No identificado)`;

    const events = parseNoIdentificados(body);
    expect(events).toHaveLength(4);
    expect(events.every((e) => e.type)).toBe(true);
    expect(events[0].plateNormalized).toBe("AG628GV");
    expect(events[0].keyId).toBe("1F9C521");
    expect(events[1].keyId).toBe("12EC248");
    expect(events[2].keyId).toBe(null);
    expect(events[2].type).toBe("no_identificado");
    expect(events[0].eventTimestamp).toBe("2026-03-02T01:44:19-03:00");
  });

  it("parsea Contacto sin identificación del día con columnas espaciadas", () => {
    const body = `Contacto sin identificación del día.
Marca    Modelo    Patente    Fecha
Toyota   Hilux     AG-572-HF   02-03-2026 09:02:01
Ford     F400      AD-374-LK   02-03-2026 11:40:40`;

    const events = parseContactoSinIdentificacion(body);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "contacto",
      plateNormalized: "AG572HF",
      brand: "Toyota",
      model: "Hilux",
      hasSpeed: false,
      speed: null,
      keyId: null,
    });
    expect(events[1].plateNormalized).toBe("AD374LK");
  });

  it("parsea Excesos con locationShort/locationRaw y keyId", () => {
    const body = `Excesos del día
116 Km/h 02/03/26 11:10:08 AG-530-IZ - Toyota Hilux 14E3382 Desconocido (14E3382) RP5, AGUADA DEL CHIVATO-AGUADA BOCAREY
115 Km/h 02/03/26 11:11:08 AG-530-IZ - Toyota Hilux 14E3382 Desconocido (14E3382) RP5, AGUADA DEL CHIVATO-AGUADA BOCAREY
120 Km/h 02/03/26 11:11:41 AG-572-HB - Toyota Hilux CEBALLOS MARIO (12E89EC) RP7`;

    const events = parseExcesos(body);
    expect(events).toHaveLength(3);

    expect(events[0].plateNormalized).toBe("AG530IZ");
    expect(events[0].speed).toBe(116);
    expect(events[0].hasSpeed).toBe(true);
    expect(events[0].locationShort).toBe("RP5");
    expect(events[0].locationRaw).toContain("RP5, AGUADA DEL CHIVATO-AGUADA BOCAREY");
    expect(events[0].keyId).toBe("14E3382");

    expect(events[2].plateNormalized).toBe("AG572HB");
    expect(events[2].locationShort).toBe("RP7");
    expect(events[2].locationRaw).toBe("RP7");
    expect(events[2].driverName).toBe("CEBALLOS MARIO");
    expect(events[2].model).toBe("Hilux");
  });

  it("no captura driverName con modelo normal (sin nombre claro)", () => {
    const body = `Excesos del día
120 Km/h 02/03/26 11:11:41 AG-572-HB - Toyota Hilux (12E89EC) RP7`;
    const events = parseExcesos(body);
    expect(events).toHaveLength(1);
    expect(events[0].model).toBe("Hilux");
    expect(events[0].driverName).toBe(null);
  });

  it("regresión: patente con espacios/guiones variables", () => {
    const body = `No identificados del día
02/03/26 01:44:19 AG - 628 - GV - Ford Ranger (No identificado)`;
    const events = parseNoIdentificados(body);
    expect(events).toHaveLength(1);
    expect(events[0].plateNormalized).toBe("AG628GV");
  });

  it("parseVehicleEventsFromEmail conserva sourceEmailType", () => {
    const subject = "Excesos del día";
    const body = "120 Km/h 02/03/26 11:11:41 AG-572-HB - Toyota Hilux (12E89EC) RP7";
    const { sourceEmailType, events } = parseVehicleEventsFromEmail(subject, body);
    expect(sourceEmailType).toBe(EMAIL_TYPE_EXCESOS);
    expect(events).toHaveLength(1);
    expect(events[0].sourceEmailType).toBe("excesos_del_dia");
  });
});
