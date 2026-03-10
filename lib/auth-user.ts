/**
 * auth-user.ts
 * Lógica de autorización por patentes usando apps/emails/access y apps/emails/vehicles.
 * - Si role ∈ ["admin","general","report"] → todas las patentes.
 * - Si no → solo patentes donde el email está en responsables/responsablesNormalized.
 */

import { requireAdminDb } from '@/lib/firebase-admin';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';

const GLOBAL_ACCESS_ROLES = ['admin', 'general', 'report'] as const;

function normalizeEmail(email: unknown): string {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeEmailArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const set = new Set<string>();
  for (const raw of values) {
    const n = normalizeEmail(raw);
    if (n) set.add(n);
  }
  return Array.from(set);
}

const ACCESS_REF = () =>
  requireAdminDb().collection('apps').doc('emails').collection('access');
const VEHICLES_REF = () =>
  requireAdminDb().collection('apps').doc('emails').collection('vehicles');

export interface EmailAccessUser {
  email: string;
  role: string;
}

export interface AuthUserWithPlates extends EmailAccessUser {
  allowedPlates: Set<string>;
}

/**
 * Lee el documento apps/emails/access/{normalizedEmail}.
 * Retorna null si no existe o no está habilitado (enabled/active).
 */
export async function getAccessUser(email: string): Promise<EmailAccessUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const docSnap = await ACCESS_REF().doc(normalized).get();
  if (!docSnap.exists) return null;

  const data = docSnap.data() ?? {};
  const isEnabled = data.enabled === true || data.active === true;
  if (!isEnabled) return null;

  return {
    email: data.email ?? normalized,
    role: data.role ?? 'responsable',
  };
}

/**
 * Lista todos los vehículos de apps/emails/vehicles (misma fuente que el backend de emails).
 */
export async function listVehicles(): Promise<
  Array<{ id: string; plate?: string; responsables?: string[]; responsablesNormalized?: string[] }>
> {
  type VehicleDoc = {
    plate?: string;
    responsables?: string[];
    responsablesNormalized?: string[];
  };

  const snap = (await VEHICLES_REF().get()) as QuerySnapshot<DocumentData>;
  return snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
    const data = doc.data() as VehicleDoc;
    return { id: doc.id, ...data };
  });
}

/**
 * Calcula las patentes permitidas para el email dado.
 * - Lee apps/emails/access/{normalizedEmail}.
 * - Si role ∈ ["admin","general","report"] → todas las patentes (listVehicles).
 * - Si no → solo patentes donde el email está en responsables/responsablesNormalized.
 */
export async function getAllowedPlatesForEmail(email: string): Promise<Set<string>> {
  const normalized = normalizeEmail(email);
  if (!normalized) return new Set<string>();

  const accessDoc = await ACCESS_REF().doc(normalized).get();
  const role = accessDoc.exists
    ? (accessDoc.data()?.role ?? 'responsable')
    : 'responsable';

  const vehicles = await listVehicles();
  const allPlates = new Set<string>();
  for (const v of vehicles) {
    const plate = v.plate ?? v.id;
    if (plate) allPlates.add(plate);
  }

  if (GLOBAL_ACCESS_ROLES.includes(role as (typeof GLOBAL_ACCESS_ROLES)[number])) {
    return allPlates;
  }

  const allowed = new Set<string>();
  for (const v of vehicles) {
    const plate = v.plate ?? v.id;
    if (!plate) continue;

    const rawResponsables = Array.isArray(v.responsables) ? v.responsables : [];
    const storedNormalized = Array.isArray(v.responsablesNormalized)
      ? v.responsablesNormalized
      : [];
    const responsablesNormalized =
      storedNormalized.length > 0
        ? normalizeEmailArray(storedNormalized)
        : normalizeEmailArray(rawResponsables);

    if (responsablesNormalized.includes(normalized)) {
      allowed.add(plate);
    }
  }
  return allowed;
}

/**
 * Devuelve el usuario de acceso con allowedPlates poblado.
 * No modifica tipos existentes; allowedPlates sigue siendo Set<string>.
 */
export async function getAuthUserWithPlates(email: string): Promise<AuthUserWithPlates | null> {
  const user = await getAccessUser(email);
  if (!user) return null;

  const allowedPlates = await getAllowedPlatesForEmail(user.email);
  return {
    ...user,
    allowedPlates,
  };
}
