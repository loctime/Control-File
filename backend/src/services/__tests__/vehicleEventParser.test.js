const {
  detectEmailType,
  parseExcesos,
  parseNoIdentificados,
  parseContactoSinIdentificacion,
  parseVehicleEventsFromEmail,
  normalizarEvento,
  parseLine,
  DEFAULT_TIMEZONE,
  EMAIL_TYPE_EXCESOS,
  EMAIL_TYPE_NO_IDENTIFICADOS,
  EMAIL_TYPE_CONTACTO,
} = require("../vehicleEventParser");

describe("vehicleEventParser", () => {
  describe("detectEmailType", () => {
    it("detecta excesos del día", () => {
      expect(detectEmailType("Excesos del día 16/02/26")).toBe(EMAIL_TYPE_EXCESOS);
      expect(detectEmailType("Exceso del día")).toBe(EMAIL_TYPE_EXCESOS);
    });

    it("detecta no identificados del día", () => {
      expect(detectEmailType("No identificados del día")).toBe(EMAIL_TYPE_NO_IDENTIFICADOS);
      expect(detectEmailType("No identificado del día 16/02")).toBe(EMAIL_TYPE_NO_IDENTIFICADOS);
    });

    it("detecta contacto sin identificación del día", () => {
      expect(detectEmailType("Contacto sin identificación del día")).toBe(EMAIL_TYPE_CONTACTO);
    });

    it("retorna null para subject vacío o no reconocido", () => {
      expect(detectEmailType("")).toBe(null);
      expect(detectEmailType("Otro asunto cualquiera")).toBe(null);
      expect(detectEmailType(null)).toBe(null);
    });
  });

  describe("parseExcesos", () => {
    it("parsea líneas con formato Km/h", () => {
      const body = `132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ruta 9 km 100
110 Km/h 04/02/26 20:15:00 AB-123-CD - FORD FOCUS calle principal`;
      const events = parseExcesos(body);
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        speed: 132,
        plate: "AF-999-EF",
        brand: "RENAULT",
        model: "KANGOO",
        eventCategory: "exceso_velocidad",
      });
      expect(events[1]).toMatchObject({
        speed: 110,
        plate: "AB-123-CD",
        brand: "FORD",
        model: "FOCUS",
      });
    });

    it("retorna array vacío para body vacío", () => {
      expect(parseExcesos("")).toEqual([]);
      expect(parseExcesos(null)).toEqual([]);
    });

    it("ignora líneas que no coinciden con el patrón", () => {
      const body = `Línea sin km/h
132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO`;
      const events = parseExcesos(body);
      expect(events).toHaveLength(1);
    });
  });

  describe("parseNoIdentificados", () => {
    it("retorna array vacío (stub)", () => {
      expect(parseNoIdentificados("cualquier texto")).toEqual([]);
    });
  });

  describe("parseContactoSinIdentificacion", () => {
    it("retorna array vacío (stub)", () => {
      expect(parseContactoSinIdentificacion("cualquier texto")).toEqual([]);
    });
  });

  describe("normalizarEvento", () => {
    it("normaliza evento de exceso con sourceEmailType", () => {
      const raw = {
        speed: 120,
        plate: "AF-999-EF",
        brand: "RENAULT",
        model: "KANGOO",
        eventTimestamp: "2026-02-04T19:27:54-03:00",
        rawLine: "120 Km/h ...",
        eventCategory: "exceso_velocidad",
      };
      const norm = normalizarEvento(raw, "excesos_del_dia");
      expect(norm).toMatchObject({
        type: "exceso",
        sourceEmailType: "excesos_del_dia",
        speed: 120,
        plate: "AF-999-EF",
        reason: null,
      });
    });
  });

  describe("parseVehicleEventsFromEmail", () => {
    it("parsea y normaliza eventos para excesos", () => {
      const subject = "Excesos del día";
      const body = "132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ruta 9";
      const { events, sourceEmailType } = parseVehicleEventsFromEmail(subject, body);
      expect(sourceEmailType).toBe(EMAIL_TYPE_EXCESOS);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "exceso",
        sourceEmailType: "excesos_del_dia",
        plate: "AF-999-EF",
      });
    });

    it("usa fallback parseExcesos cuando subject no reconocido", () => {
      const subject = "Asunto desconocido";
      const body = "132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO";
      const { events, sourceEmailType } = parseVehicleEventsFromEmail(subject, body);
      expect(sourceEmailType).toBe(null);
      expect(events).toHaveLength(1);
    });
  });

  describe("parseLine", () => {
    it("retorna null para línea sin km/h", () => {
      expect(parseLine("línea normal")).toBe(null);
    });

    it("retorna evento para línea válida", () => {
      const event = parseLine("132 Km/h 04/02/26 19:27:54 AF-999-EF - RENAULT KANGOO ruta 9");
      expect(event).not.toBe(null);
      expect(event.speed).toBe(132);
      expect(event.plate).toBe("AF-999-EF");
    });
  });
});
