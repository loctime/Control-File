const {
  generateDeterministicEventId,
  normalizePlate,
  isFromAllowedDomain,
  computeRiskScore,
} = require("../vehicleEventService");

describe("vehicleEventService", () => {
  describe("generateDeterministicEventId", () => {
    it("genera id determinístico para mismos inputs", () => {
      const id1 = generateDeterministicEventId("AF999EF", "2026-02-04T19:27:54-03:00", "raw line");
      const id2 = generateDeterministicEventId("AF999EF", "2026-02-04T19:27:54-03:00", "raw line");
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{32}$/);
    });

    it("genera ids distintos para inputs distintos", () => {
      const id1 = generateDeterministicEventId("AF999EF", "2026-02-04T19:27:54-03:00", "line1");
      const id2 = generateDeterministicEventId("AF999EF", "2026-02-04T19:27:55-03:00", "line1");
      expect(id1).not.toBe(id2);
    });
  });

  describe("normalizePlate", () => {
    it("normaliza patente eliminando espacios, guiones y caracteres especiales, convierte a mayúsculas", () => {
      expect(normalizePlate("af 999 ef")).toBe("AF999EF");
      expect(normalizePlate("  AB-123-CD  ")).toBe("AB123CD");
      expect(normalizePlate("af-999-ef")).toBe("AF999EF");
      expect(normalizePlate("AF 999 EF")).toBe("AF999EF");
      expect(normalizePlate("ab.123.cd")).toBe("AB123CD");
    });

    it("retorna string vacío para input inválido", () => {
      expect(normalizePlate("")).toBe("");
      expect(normalizePlate(null)).toBe("");
      expect(normalizePlate(undefined)).toBe("");
    });
  });

  describe("isFromAllowedDomain", () => {
    it("retorna true cuando from pertenece a dominio permitido", () => {
      expect(isFromAllowedDomain("alerta@pluspetrol.com", "pluspetrol.com")).toBe(true);
      expect(isFromAllowedDomain("user@sub.pluspetrol.com", "pluspetrol.com")).toBe(true);
    });

    it("retorna false cuando from no pertenece", () => {
      expect(isFromAllowedDomain("otro@gmail.com", "pluspetrol.com")).toBe(false);
      expect(isFromAllowedDomain("", "pluspetrol.com")).toBe(false);
      expect(isFromAllowedDomain("a@b.com", "")).toBe(false);
    });

    it("soporta múltiples dominios separados por coma", () => {
      expect(isFromAllowedDomain("a@pluspetrol.com", "pluspetrol.com,otro.com")).toBe(true);
      expect(isFromAllowedDomain("a@otro.com", "pluspetrol.com,otro.com")).toBe(true);
    });
  });

  describe("computeRiskScore", () => {
    it("devuelve 0 para summary y events vacíos", () => {
      expect(computeRiskScore(null, null)).toBe(0);
      expect(computeRiskScore({}, [])).toBe(0);
    });

    it("score por summary = suma de totales por tipo cuando events vacío", () => {
      const summary = { excesos: 2, no_identificados: 1, contactos: 0, llave_sin_cargar: 0, conductor_inactivo: 0 };
      expect(computeRiskScore(summary, [])).toBe(2 + 1); // total eventos
    });

    it("score = total eventos (cantidad)", () => {
      const events = [{ severity: "critico" }, { severity: "critico" }, {}];
      expect(computeRiskScore(null, events)).toBe(3);
    });

    it("usa sum de summary cuando events está vacío", () => {
      const summary = { excesos: 1, no_identificados: 0, contactos: 1, llave_sin_cargar: 0, conductor_inactivo: 0 };
      expect(computeRiskScore(summary, [])).toBe(2);
    });
  });
});
