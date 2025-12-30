// Helper centralizado para asegurar carpetas de apps en el taskbar
// ✔️ Idempotente
// ✔️ Multiusuario seguro
// ✔️ Sin queries
// ✔️ Sin duplicados
// ✔️ A prueba de React StrictMode / múltiples tabs

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeAppId } from "./app-ownership";

export interface EnsureTaskbarFolderOptions {
  appId: string;     // "controlaudit"
  appName: string;   // "ControlAudit"
  userId: string;
  icon?: string;
  color?: string;
}

/**
 * Asegura la carpeta raíz de una app en el taskbar.
 *
 * REGLAS DEFINITIVAS:
 * - 1 carpeta por USUARIO + APP
 * - ID determinístico
 * - Sin búsquedas
 * - Seguro ejecutar N veces
 */
export async function ensureTaskbarAppFolder({
  appId,
  appName,
  userId,
  icon = "Folder",
  color = "text-blue-600",
}: EnsureTaskbarFolderOptions): Promise<string> {
  if (!db) {
    throw new Error("ensureTaskbarAppFolder: Firebase no inicializado");
  }

  if (!userId || !appId || !appName) {
    throw new Error("ensureTaskbarAppFolder: faltan parámetros obligatorios");
  }

  const normalizedAppId = normalizeAppId(appId);

  /**
   * 🔒 ID DETERMINÍSTICO Y MULTIUSUARIO
   * Formato FINAL:
   * taskbar_<userId>_<appId>
   *
   * Ej:
   * taskbar_uid123_controlaudit
   */
  const folderId = `taskbar_${userId}_${normalizedAppId}`;
  const ref = doc(db, "files", folderId);

  /**
   * ⚠️ GUARD DE SESIÓN
   * Evita writes repetidos en:
   * - React StrictMode
   * - Re-renders
   * - Navegación interna
   */
  const sessionKey = `taskbar_init_${folderId}`;
  if (typeof window !== "undefined") {
    if (sessionStorage.getItem(sessionKey)) {
      return folderId;
    }
    sessionStorage.setItem(sessionKey, "1");
  }

  const slug = appName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

  /**
   * ⚠️ createdAt:
   * - NO se confía para auditoría
   * - se setea solo la primera vez (merge lo respeta)
   */
  const folderData = {
    id: folderId,
    userId,
    appId: normalizedAppId,

    name: appName,
    slug,

    type: "folder" as const,
    parentId: null,
    path: [],

    deletedAt: null,

    updatedAt: serverTimestamp(),

    metadata: {
      source: "taskbar",          // 🔑 CLAVE ABSOLUTA
      appId: normalizedAppId,
      icon,
      color,
      isSystem: true,             // carpeta del sistema
      canDelete: false,           // no eliminable
      description: `Carpeta principal de ${appName}`,
    },
  };

  /**
   * ✅ ESCRITURA IDEMPOTENTE
   * - No duplica
   * - No pisa datos existentes innecesariamente
   * - Seguro ante múltiples tabs
   */
  await setDoc(ref, folderData, { merge: true });

  return folderId;
}
