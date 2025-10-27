const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const b2Service = require('../services/b2');

// Import auth middleware
const authMiddleware = require('../middleware/auth');

// Create share (protected)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { fileId, expiresIn = 24 } = req.body; // expiresIn in hours
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.deletedAt) {
      return res.status(404).json({ error: 'Archivo eliminado' });
    }

    // Generate share token
    const shareToken = Math.random().toString(36).substr(2, 15) + 
                      Math.random().toString(36).substr(2, 15);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

    // Create share record
    const shareRef = admin.firestore().collection('shares').doc(shareToken);
    await shareRef.set({
      token: shareToken,
      fileId,
      uid,
      fileName: fileData.name,
      fileSize: fileData.size,
      mime: fileData.mime,
      expiresAt,
      createdAt: new Date(),
      isActive: true,
      downloadCount: 0,
    });

    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL}/share/${shareToken}`;

    res.json({
      shareToken,
      shareUrl,
      expiresAt,
      fileName: fileData.name,
    });
  } catch (error) {
    console.error('Error creating share:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get share info (public)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Get share from Firestore
    const shareRef = admin.firestore().collection('shares').doc(token);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Enlace de compartir no encontrado' });
    }

    const shareData = shareDoc.data();

    // Check if share is expired
    if (shareData.expiresAt.toDate() < new Date()) {
      return res.status(410).json({ error: 'Enlace expirado' });
    }

    // Check if share is active
    if (!shareData.isActive) {
      return res.status(410).json({ error: 'Enlace revocado' });
    }

    res.json({
      fileName: shareData.fileName,
      fileSize: shareData.fileSize,
      mime: shareData.mime,
      expiresAt: shareData.expiresAt,
      downloadCount: shareData.downloadCount,
    });
  } catch (error) {
    console.error('Error getting share info:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Download shared file
router.post('/:token/download', async (req, res) => {
  try {
    const { token } = req.params;

    // Get share from Firestore
    const shareRef = admin.firestore().collection('shares').doc(token);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Enlace de compartir no encontrado' });
    }

    const shareData = shareDoc.data();

    // Check if share is expired
    if (shareData.expiresAt.toDate() < new Date()) {
      return res.status(410).json({ error: 'Enlace expirado' });
    }

    // Check if share is active
    if (!shareData.isActive) {
      return res.status(410).json({ error: 'Enlace revocado' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(shareData.fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();

    if (fileData.deletedAt) {
      return res.status(404).json({ error: 'Archivo eliminado' });
    }

    // Virus scan si es archivo compartido sospechoso y no ha sido escaneado
    const cloudmersive = require('../services/cloudmersive');
    if (cloudmersive.enabled && !shareData.virusScanned && cloudmersive.isSuspiciousFile(fileData.name, fileData.size, fileData.mime)) {
      console.log('🛡️ Scanning shared file for viruses...');
      try {
        const fileBuffer = await b2Service.getObjectBuffer(fileData.bucketKey);
        const virusScanResult = await cloudmersive.scanVirus(fileBuffer);
        
        if (!virusScanResult.clean) {
          // Revocar share automáticamente
          await shareRef.update({ 
            isActive: false,
            revokedReason: `Virus detectado: ${virusScanResult.virusName}`
          });
          
          return res.status(400).json({ 
            error: 'Archivo contiene virus y fue bloqueado',
            code: 'VIRUS_DETECTED'
          });
        }
        
        // Marcar como escaneado
        await shareRef.update({ virusScanned: true });
        console.log('✅ Shared file virus scan passed');
        
      } catch (error) {
        console.error('⚠️ Virus scan failed:', error);
        // Continuar sin escaneo si falla
      }
    }

    // Generate presigned URL
    const downloadUrl = await b2Service.createPresignedGetUrl(fileData.bucketKey, 300); // 5 minutes

    // Update download count
    await shareRef.update({
      downloadCount: admin.firestore.FieldValue.increment(1),
    });

    res.json({
      downloadUrl,
      fileName: fileData.name,
      fileSize: fileData.size,
    });
  } catch (error) {
    console.error('Error downloading shared file:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get shared file directly (public, for embedding in <img> tags)
router.get('/:token/image', async (req, res) => {
  try {
    const { token } = req.params;

    // Get share from Firestore
    const shareRef = admin.firestore().collection('shares').doc(token);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Enlace de compartir no encontrado' });
    }

    const shareData = shareDoc.data();

    // Check if share is expired
    if (shareData.expiresAt.toDate() < new Date()) {
      return res.status(410).json({ error: 'Enlace expirado' });
    }

    // Check if share is active
    if (!shareData.isActive) {
      return res.status(410).json({ error: 'Enlace revocado' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(shareData.fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();

    if (fileData.deletedAt) {
      return res.status(404).json({ error: 'Archivo eliminado' });
    }

    // Generate presigned URL and redirect (1 hour validity for better caching)
    const downloadUrl = await b2Service.createPresignedGetUrl(fileData.bucketKey, 3600);

    // Update download count
    await shareRef.update({
      downloadCount: admin.firestore.FieldValue.increment(1),
    });

    // Redirect to the actual file URL
    res.redirect(downloadUrl);
  } catch (error) {
    console.error('Error getting shared image:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Revoke share (protected)
router.post('/revoke', authMiddleware, async (req, res) => {
  try {
    const { shareToken } = req.body;
    const { uid } = req.user;

    if (!shareToken) {
      return res.status(400).json({ error: 'Token de compartir requerido' });
    }

    // Get share from Firestore
    const shareRef = admin.firestore().collection('shares').doc(shareToken);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Enlace de compartir no encontrado' });
    }

    const shareData = shareDoc.data();
    if (shareData.uid !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Revoke share
    await shareRef.update({
      isActive: false,
      revokedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Enlace revocado exitosamente',
    });
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// List user's shares (protected)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;

    // Get user's shares
    const sharesSnapshot = await admin.firestore()
      .collection('shares')
      .where('uid', '==', uid)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const shares = [];
    sharesSnapshot.forEach(doc => {
      const shareData = doc.data();
      shares.push({
        token: shareData.token,
        fileName: shareData.fileName,
        fileSize: shareData.fileSize,
        expiresAt: shareData.expiresAt,
        createdAt: shareData.createdAt,
        downloadCount: shareData.downloadCount,
        shareUrl: `${process.env.FRONTEND_URL}/share/${shareData.token}`,
      });
    });

    res.json({ shares });
  } catch (error) {
    console.error('Error listing shares:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Increment download counter (public, called by Cloudflare Worker)
// Este endpoint es ligero y no requiere autenticación porque el Worker ya validó el share
router.post('/:token/increment-counter', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Incrementar el contador sin validaciones adicionales
    // El Worker ya validó que el share existe y es válido
    const shareRef = admin.firestore().collection('shares').doc(token);
    
    await shareRef.update({
      downloadCount: admin.firestore.FieldValue.increment(1),
      lastDownloadAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    // Si falla, no es crítico - el share ya se sirvió desde el Worker
    console.error('Error incrementing counter:', error);
    // Responder success de todos modos para no hacer retry innecesarios
    res.json({ success: true, warning: 'Counter not updated' });
  }
});

module.exports = router;