// backend/src/services/tanstack-cache.js
const { QueryClient } = require('@tanstack/react-query');

class TanStackCache {
  constructor() {
    this.queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutos
          gcTime: 10 * 60 * 1000,   // 10 minutos
          retry: 2,
          refetchOnWindowFocus: false,
        },
      },
    });
    
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
    };
  }

  // Obtener datos con cache inteligente
  async getFiles(userId, folderId) {
    const cacheKey = `files-${userId}-${folderId}`;
    this.stats.totalRequests++;

    try {
      const result = await this.queryClient.fetchQuery({
        queryKey: ['files', userId, folderId],
        queryFn: async () => {
          // Simular fetch de base de datos
          console.log(`🔍 Fetching files from DB for user ${userId}, folder ${folderId}`);
          return await this.fetchFilesFromDB(userId, folderId);
        },
      });

      this.stats.hits++;
      console.log(`✅ Cache HIT for ${cacheKey}`);
      return result;
    } catch (error) {
      this.stats.misses++;
      console.log(`❌ Cache MISS for ${cacheKey}:`, error.message);
      throw error;
    }
  }

  // Obtener carpetas con cache
  async getFolders(userId) {
    const cacheKey = `folders-${userId}`;
    this.stats.totalRequests++;

    try {
      const result = await this.queryClient.fetchQuery({
        queryKey: ['folders', userId],
        queryFn: async () => {
          console.log(`🔍 Fetching folders from DB for user ${userId}`);
          return await this.fetchFoldersFromDB(userId);
        },
      });

      this.stats.hits++;
      console.log(`✅ Cache HIT for ${cacheKey}`);
      return result;
    } catch (error) {
      this.stats.misses++;
      console.log(`❌ Cache MISS for ${cacheKey}:`, error.message);
      throw error;
    }
  }

  // Prefetch de datos relacionados
  async prefetchRelatedData(userId, folderId) {
    try {
      // Prefetch de carpetas si no están en cache
      await this.queryClient.prefetchQuery({
        queryKey: ['folders', userId],
        queryFn: () => this.fetchFoldersFromDB(userId),
        staleTime: 5 * 60 * 1000,
      });

      // Prefetch de archivos de carpetas padre
      if (folderId) {
        await this.queryClient.prefetchQuery({
          queryKey: ['files', userId, null],
          queryFn: () => this.fetchFilesFromDB(userId, null),
          staleTime: 5 * 60 * 1000,
        });
      }

      console.log(`🚀 Prefetched related data for user ${userId}`);
    } catch (error) {
      console.log(`⚠️ Prefetch error:`, error.message);
    }
  }

  // Invalidar cache específico
  invalidateFiles(userId, folderId) {
    this.queryClient.invalidateQueries({
      queryKey: ['files', userId, folderId],
    });
    console.log(`🗑️ Invalidated cache for files-${userId}-${folderId}`);
  }

  // Invalidar todo el cache de un usuario
  invalidateUser(userId) {
    this.queryClient.invalidateQueries({
      queryKey: ['files', userId],
    });
    this.queryClient.invalidateQueries({
      queryKey: ['folders', userId],
    });
    console.log(`🗑️ Invalidated all cache for user ${userId}`);
  }

  // Obtener estadísticas del cache
  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.queryClient.getQueryCache().getAll().length,
    };
  }

  // Fetch real de base de datos usando Firestore
  async fetchFilesFromDB(userId, folderId) {
    const admin = require('firebase-admin');
    const { getAppCode } = require('./metadata');
    
    try {
      const APP_CODE = getAppCode();
      const items = [];

      // Get files from 'files' collection
      let filesQuery = admin.firestore()
        .collection('files')
        .where('userId', '==', userId)
        .where('isDeleted', '==', false);

      if (folderId === null) {
        filesQuery = filesQuery.where('parentId', '==', null);
      } else if (typeof folderId === 'string' && folderId.length > 0) {
        filesQuery = filesQuery.where('parentId', '==', folderId);
      }

      if (APP_CODE !== 'controlfile') {
        filesQuery = filesQuery.where('appCode', '==', APP_CODE);
      }

      filesQuery = filesQuery.orderBy('updatedAt', 'desc');

      const filesSnap = await filesQuery.get();
      filesSnap.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          ...data,
          type: 'file'
        });
      });

      // Get folders from 'folders' collection
      let foldersQuery = admin.firestore()
        .collection('folders')
        .where('userId', '==', userId)
        .where('isDeleted', '==', false);

      if (folderId === null) {
        foldersQuery = foldersQuery.where('parentId', '==', null);
      } else if (typeof folderId === 'string' && folderId.length > 0) {
        foldersQuery = foldersQuery.where('parentId', '==', folderId);
      }

      if (APP_CODE !== 'controlfile') {
        foldersQuery = foldersQuery.where('appCode', '==', APP_CODE);
      }

      foldersQuery = foldersQuery.orderBy('updatedAt', 'desc');

      const foldersSnap = await foldersQuery.get();
      foldersSnap.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          ...data,
          type: 'folder'
        });
      });

      // Sort by updatedAt desc
      items.sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.() || new Date(a.updatedAt);
        const bTime = b.updatedAt?.toDate?.() || new Date(b.updatedAt);
        return bTime - aTime;
      });

      console.log(`📊 Fetched ${items.length} items from DB for user ${userId}, folder ${folderId}`);
      return items;
    } catch (error) {
      console.error('Error fetching files from DB:', error);
      throw error;
    }
  }

  async fetchFoldersFromDB(userId) {
    const admin = require('firebase-admin');
    const { getAppCode } = require('./metadata');
    
    try {
      const APP_CODE = getAppCode();
      const folders = [];

      let foldersQuery = admin.firestore()
        .collection('folders')
        .where('userId', '==', userId)
        .where('isDeleted', '==', false);

      if (APP_CODE !== 'controlfile') {
        foldersQuery = foldersQuery.where('appCode', '==', APP_CODE);
      }

      foldersQuery = foldersQuery.orderBy('updatedAt', 'desc');

      const foldersSnap = await foldersQuery.get();
      foldersSnap.forEach(doc => {
        const data = doc.data();
        folders.push({
          id: doc.id,
          ...data,
          type: 'folder'
        });
      });

      console.log(`📁 Fetched ${folders.length} folders from DB for user ${userId}`);
      return folders;
    } catch (error) {
      console.error('Error fetching folders from DB:', error);
      throw error;
    }
  }
}

// Instancia singleton
const tanStackCache = new TanStackCache();

module.exports = tanStackCache;
