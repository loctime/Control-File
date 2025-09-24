const admin = require('firebase-admin');

const APP_CODE = process.env.APP_CODE || 'controlfile';

function getAppCode() {
  return APP_CODE;
}

async function getFolderDoc(folderId) {
  if (!folderId) return null;
  const ref = admin.firestore().collection('folders').doc(folderId);
  const snap = await ref.get();
  return snap.exists ? { id: ref.id, data: snap.data() } : null;
}

async function getOrCreateAppRootFolder(uid) {
  const foldersCol = admin.firestore().collection('folders');

  const q = await foldersCol
    .where('userId', '==', uid)
    .where('parentId', '==', null)
    .where('name', '==', APP_CODE)
    .limit(1)
    .get();

  if (!q.empty) {
    const d = q.docs[0];
    return { id: d.id, data: d.data() };
  }

  // Create root folder for this app
  const folderId = `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const folderRef = foldersCol.doc(folderId);

  const slug = APP_CODE.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const folderDoc = {
    id: folderId,
    userId: uid,
    name: APP_CODE,
    slug: slug,
    parentId: null,
    path: `/${slug}`,
    appCode: APP_CODE,
    ancestors: [],
    createdAt: new Date(),
    modifiedAt: new Date(),
    type: 'folder',
    metadata: {
      isMainFolder: true,
      isDefault: true,
      icon: 'Folder',
      color: 'text-purple-600',
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    },
  };

  await folderRef.set(folderDoc);
  return { id: folderId, data: folderDoc };
}

async function resolveParentAndAncestors(uid, parentId) {
  if (parentId) {
    const parent = await getFolderDoc(parentId);
    if (!parent) {
      console.warn(`⚠️ Carpeta padre no encontrada: ${parentId}, usando carpeta raíz por defecto`);
      // En lugar de fallar, usar la carpeta raíz por defecto
      if (APP_CODE === 'controlfile') {
        return {
          parentId: null,
          path: '',
          ancestors: [],
        };
      }
      const root = await getOrCreateAppRootFolder(uid);
      return {
        parentId: root.id,
        path: root.data.path || `/${APP_CODE}`,
        ancestors: [root.id],
      };
    }
    const parentAncestors = Array.isArray(parent.data.ancestors) ? parent.data.ancestors : [];
    return {
      parentId,
      path: parent.data.path || '',
      ancestors: [...parentAncestors, parentId],
    };
  }

  // Compatibilidad: para controlfile mantenemos raíz clásica (parentId null)
  if (APP_CODE === 'controlfile') {
    return {
      parentId: null,
      path: '',
      ancestors: [],
    };
  }

  const root = await getOrCreateAppRootFolder(uid);
  return {
    parentId: root.id,
    path: root.data.path || `/${APP_CODE}`,
    ancestors: [root.id],
  };
}

function assertItemVisibleForApp(itemData) {
  if (!itemData) return false;
  if (APP_CODE === 'controlfile') return true; // super-app ve todo
  return itemData.appCode === APP_CODE;
}

module.exports = {
  getAppCode,
  getOrCreateAppRootFolder,
  resolveParentAndAncestors,
  assertItemVisibleForApp,
};


