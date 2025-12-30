import { normalizeAppId } from "./app-ownership";

interface EnsureTaskbarFolderServerOptions {
  appId: string;
  appName: string;
  userId: string;
  adminDb: any; // Firestore Admin SDK
  icon?: string;
  color?: string;
}

export async function ensureTaskbarAppFolderServer({
  appId,
  appName,
  userId,
  adminDb,
  icon = "Folder",
  color = "text-blue-600",
}: EnsureTaskbarFolderServerOptions): Promise<string> {
  if (!adminDb || !userId || !appId) {
    throw new Error("ensureTaskbarAppFolderServer: parámetros inválidos");
  }

  const normalizedAppId = normalizeAppId(appId);
  const folderId = `taskbar_${userId}_${normalizedAppId}`;

  await adminDb
    .collection("files")
    .doc(folderId)
    .set(
      {
        id: folderId,
        userId,
        appId: normalizedAppId,
        name: appName,
        type: "folder",
        parentId: null,
        path: [],
        deletedAt: null,
        updatedAt: new Date(),
        metadata: {
          source: "taskbar",
          appId: normalizedAppId,
          icon,
          color,
          isSystem: true,
          canDelete: false,
        },
      },
      { merge: true }
    );

  return folderId;
}
