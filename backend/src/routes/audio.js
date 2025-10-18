const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const b2Service = require('../services/b2');
const audioProcessing = require('../services/audio-processing');
const { getAppCode, assertItemVisibleForApp } = require('../services/metadata');

/**
 * Masterizar archivo de audio
 * POST /api/audio/master
 * Body: { fileId: string, action: 'create' | 'replace' }
 */
router.post('/master', async (req, res) => {
  try {
    const { fileId, action } = req.body;
    const { uid } = req.user;
    const APP_CODE = getAppCode();

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    if (!action || !['create', 'replace'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Use "create" o "replace"' });
    }

    // Obtener archivo de Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    
    // Verificar propiedad
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(400).json({ error: 'Archivo eliminado' });
    }

    // Validar archivo de audio
    const validation = audioProcessing.validateAudioFile(fileData.mime, fileData.size);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    console.log(`🎵 Iniciando masterización de audio: ${fileData.name}`);

    // Descargar archivo de B2
    const inputBuffer = await b2Service.getObjectBuffer(fileData.bucketKey);
    console.log(`📥 Archivo descargado: ${inputBuffer.length} bytes`);

    // Determinar formatos de entrada y salida
    const formats = audioProcessing.getAudioFormats(fileData.mime);
    console.log(`🔧 Formatos: ${formats.inputFormat} → ${formats.outputFormat}`);

    // Procesar audio con FFmpeg
    let masteredBuffer;
    if (formats.outputFormat === 'mp3') {
      masteredBuffer = await audioProcessing.masterAudioToMp3(inputBuffer);
    } else {
      masteredBuffer = await audioProcessing.masterAudioFile(inputBuffer, formats.inputFormat, formats.outputFormat);
    }

    console.log(`✅ Audio masterizado: ${masteredBuffer.length} bytes`);

    if (action === 'create') {
      // Crear nuevo archivo masterizado
      const masteredName = fileData.name.replace(/\.(wav|mp3)$/i, '_mastered.$1');
      const masteredKey = `${uid}/${Date.now()}_${masteredName}`;

      // Subir archivo masterizado a B2
      await b2Service.uploadFileDirectly(masteredKey, masteredBuffer, formats.outputMime);

      // Crear registro en Firestore
      const newFileRef = admin.firestore().collection('files').doc();
      await newFileRef.set({
        id: newFileRef.id,
        userId: uid,
        name: masteredName,
        bucketKey: masteredKey,
        key: masteredKey,
        size: masteredBuffer.length,
        mime: formats.outputMime,
        parentId: fileData.parentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        appCode: fileData.appCode || APP_CODE,
        originalFileId: fileId, // Referencia al archivo original
        mastered: true // Marcar como masterizado
      });

      // Actualizar cuota del usuario
      const userRef = admin.firestore().collection('users').doc(uid);
      await userRef.update({
        usedBytes: admin.firestore.FieldValue.increment(masteredBuffer.length)
      });

      console.log(`📁 Archivo masterizado creado: ${masteredName}`);

      res.json({
        success: true,
        message: 'Audio masterizado exitosamente',
        fileId: newFileRef.id,
        fileName: masteredName,
        fileSize: masteredBuffer.length,
        action: 'created'
      });

    } else if (action === 'replace') {
      // Reemplazar archivo original
      const oldSize = fileData.size;
      const newSize = masteredBuffer.length;

      // Subir archivo masterizado con la misma clave
      await b2Service.uploadFileDirectly(fileData.bucketKey, masteredBuffer, formats.outputMime);

      // Actualizar metadatos en Firestore
      await fileRef.update({
        size: newSize,
        mime: formats.outputMime,
        updatedAt: new Date(),
        mastered: true,
        masteredAt: new Date()
      });

      // Ajustar cuota del usuario
      const userRef = admin.firestore().collection('users').doc(uid);
      await userRef.update({
        usedBytes: admin.firestore.FieldValue.increment(newSize - oldSize)
      });

      console.log(`🔄 Archivo original reemplazado: ${fileData.name}`);

      res.json({
        success: true,
        message: 'Audio masterizado y reemplazado exitosamente',
        fileId: fileId,
        fileName: fileData.name,
        fileSize: newSize,
        action: 'replaced'
      });
    }

  } catch (error) {
    console.error('Error en masterización de audio:', error);
    
    // Manejar errores específicos de FFmpeg
    if (error.message.includes('FFmpeg') || error.message.includes('procesamiento')) {
      return res.status(500).json({ 
        error: 'Error de procesamiento de audio',
        details: 'El archivo podría estar corrupto o en formato no soportado'
      });
    }

    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Obtener información de un archivo de audio para masterización
 * GET /api/audio/info/:fileId
 */
router.get('/info/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Obtener archivo de Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    
    // Verificar propiedad
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(400).json({ error: 'Archivo eliminado' });
    }

    // Validar si es archivo de audio soportado
    const validation = audioProcessing.validateAudioFile(fileData.mime, fileData.size);
    
    res.json({
      fileId: fileId,
      fileName: fileData.name,
      fileSize: fileData.size,
      mimeType: fileData.mime,
      canMaster: validation.isValid,
      error: validation.error,
      isMastered: fileData.mastered || false
    });

  } catch (error) {
    console.error('Error obteniendo info de audio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
