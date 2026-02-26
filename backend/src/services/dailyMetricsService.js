/**
 * dailyMetricsService.js
 * Servicio para lectura de métricas diarias (v2). Base para métricas históricas.
 * Lee desde dailyAlerts/meta y dailyAlerts/vehicles.
 */

const admin = require("firebase-admin");
const { normalizePlate } = require("./vehicleEventService");

function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

const DAILY_ALERTS_REF = () =>
  getDb().collection("apps").doc("emails").collection("dailyAlerts");

/**
 * Totales por tipo del día desde meta.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<{ excesos: number, no_identificados: number, contactos: number, llave_sin_cargar: number, conductor_inactivo: number, ...meta }>}
 */
async function getDailyTotalsByType(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return {
      excesos: 0,
      no_identificados: 0,
      contactos: 0,
      llave_sin_cargar: 0,
      conductor_inactivo: 0,
      totalVehicles: 0,
      totalEvents: 0,
      totalCriticos: 0,
      totalAdvertencias: 0,
      totalAdministrativos: 0,
      vehiclesWithCritical: 0,
    };
  }

  const metaSnap = await DAILY_ALERTS_REF()
    .doc(dateKey)
    .collection("meta")
    .doc("meta")
    .get();

  if (!metaSnap.exists) {
    return {
      excesos: 0,
      no_identificados: 0,
      contactos: 0,
      llave_sin_cargar: 0,
      conductor_inactivo: 0,
      totalVehicles: 0,
      totalEvents: 0,
      totalCriticos: 0,
      totalAdvertencias: 0,
      totalAdministrativos: 0,
      vehiclesWithCritical: 0,
    };
  }

  const meta = metaSnap.data();
  return {
    excesos: meta.totalExcesos ?? 0,
    no_identificados: meta.totalNoIdentificados ?? 0,
    contactos: meta.totalContactos ?? 0,
    llave_sin_cargar: meta.totalLlaveSinCargar ?? 0,
    conductor_inactivo: meta.totalConductorInactivo ?? 0,
    totalVehicles: meta.totalVehicles ?? 0,
    totalEvents: meta.totalEvents ?? 0,
    totalCriticos: meta.totalCriticos ?? 0,
    totalAdvertencias: meta.totalAdvertencias ?? 0,
    totalAdministrativos: meta.totalAdministrativos ?? 0,
    vehiclesWithCritical: meta.vehiclesWithCritical ?? 0,
    lastUpdatedAt: meta.lastUpdatedAt ?? null,
  };
}

/**
 * Resumen diario de un vehículo para una fecha.
 * @param {string} plate - Patente (se normaliza)
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<object|null>} Documento vehicle de dailyAlerts o null
 */
async function getVehicleDailySummary(plate, dateKey) {
  if (!plate || !dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;

  const normalized = normalizePlate(plate);
  const docSnap = await DAILY_ALERTS_REF()
    .doc(dateKey)
    .collection("vehicles")
    .doc(normalized)
    .get();

  if (!docSnap.exists) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

module.exports = {
  getDailyTotalsByType,
  getVehicleDailySummary,
};
