// ControlFile Cloudflare Worker - Optimized Image Sharing
// This worker minimizes Render Free backend usage by handling shares directly

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Route: /image/{token} - Get shared image directly
  if (url.pathname.startsWith('/image/')) {
    const token = url.pathname.split('/image/')[1]
    if (token) {
      return handleImageShare(token, request, corsHeaders)
    }
  }
  
  // Health check
  if (url.pathname === '/health' || url.pathname === '/') {
    return new Response('ControlFile Shares Worker - Running ✅', { 
      status: 200,
      headers: corsHeaders
    })
  }
  
  return new Response('Not Found. Use: /image/{share-token}', { 
    status: 404,
    headers: corsHeaders
  })
}

async function handleImageShare(token, request, corsHeaders) {
  // Cache key único por token
  const cacheKey = new Request(`https://cache.internal/share/${token}`, request)
  const cache = caches.default
  
  try {
    // 1. Intentar obtener del caché (1 hora)
    let cachedResponse = await cache.match(cacheKey)
    if (cachedResponse) {
      console.log(`Cache HIT: ${token}`)
      // Agregar headers CORS a respuesta cacheada
      const newHeaders = new Headers(cachedResponse.headers)
      Object.entries(corsHeaders).forEach(([key, value]) => newHeaders.set(key, value))
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: newHeaders
      })
    }
    
    console.log(`Cache MISS: ${token}`)
    
    // 2. Obtener share desde Firestore (sin backend)
    const shareData = await getShareFromFirestore(token)
    
    if (!shareData) {
      return jsonResponse({ error: 'Enlace de compartir no encontrado' }, 404, corsHeaders)
    }
    
    // 3. Validar expiración
    const expiresAt = shareData.expiresAt ? new Date(shareData.expiresAt._seconds * 1000) : null
    if (expiresAt && expiresAt < new Date()) {
      return jsonResponse({ error: 'Enlace expirado' }, 410, corsHeaders)
    }
    
    // 4. Validar estado activo (retrocompatible: isActive = nuevo, isPublic = legacy)
    if (shareData.isActive === false || shareData.isPublic === false) {
      return jsonResponse({ error: 'Enlace revocado' }, 410, corsHeaders)
    }
    
    // 5. Obtener file desde Firestore
    const fileData = await getFileFromFirestore(shareData.fileId)
    
    if (!fileData) {
      return jsonResponse({ error: 'Archivo no encontrado' }, 404, corsHeaders)
    }
    
    // Validar archivo eliminado (usar deletedAt, consistente con backend)
    if (fileData.deletedAt) {
      return jsonResponse({ error: 'Archivo eliminado' }, 404, corsHeaders)
    }
    
    // 6. Validar bucketKey (shares solo soportan almacenamiento B2)
    if (!fileData.bucketKey) {
      console.error(`File missing bucketKey for share image`, { fileId: shareData.fileId, token })
      return jsonResponse({ 
        error: 'Archivo no compatible con share/image',
        code: 'FILE_STORAGE_KEY_MISSING'
      }, 415, corsHeaders)
    }
    
    // 7. Generar URL de B2 (público o presignado)
    const b2Url = generateB2Url(fileData.bucketKey)
    
    // 8. Crear respuesta redirect con caché
    const response = Response.redirect(b2Url, 302)
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...corsHeaders,
        'Location': b2Url,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hora
        'X-Share-Token': token,
        'X-Cache-Status': 'MISS'
      }
    })
    
    // 9. Guardar en caché por 1 hora
    await cache.put(cacheKey, newResponse.clone())
    
    // 10. Incrementar contador de descargas (async, no bloquea respuesta)
    // Solo si está configurado el backend
    if (typeof BACKEND_URL !== 'undefined' && BACKEND_URL) {
      // waitUntil no está disponible aquí, pero la respuesta ya se envía
      incrementDownloadCount(token).catch(err => console.error('Error incrementing counter:', err))
    }
    
    return newResponse
    
  } catch (error) {
    console.error(`Error handling share ${token}:`, error)
    return jsonResponse({ 
      error: 'Error interno del servidor',
      details: error.message 
    }, 500, corsHeaders)
  }
}

// Obtener share directamente de Firestore REST API (público, sin auth)
async function getShareFromFirestore(token) {
  // Firestore REST API no requiere autenticación para lecturas si las reglas lo permiten
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shares/${token}`
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 404) return null
      console.error(`Firestore error for share ${token}: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    return parseFirestoreDocument(data)
  } catch (error) {
    console.error(`Error fetching share ${token}:`, error)
    return null
  }
}

// Obtener file directamente de Firestore
async function getFileFromFirestore(fileId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/files/${fileId}`
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 404) return null
      console.error(`Firestore error for file ${fileId}: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    return parseFirestoreDocument(data)
  } catch (error) {
    console.error(`Error fetching file ${fileId}:`, error)
    return null
  }
}

// Generar URL de B2
function generateB2Url(bucketKey) {
  // ⚠️ IMPORTANTE:
  // Este worker asume bucket B2 público.
  // Si el bucket se vuelve privado, este método DEBE reemplazarse
  // por un presigned URL generado por backend.
  // 
  // Limitaciones actuales:
  // - No soporta versionado de objetos
  // - No tiene expiración (URLs permanentes)
  // - No funciona si el bucket cambia a privado
  // - No funciona si cambia la región del bucket
  
  // Si el bucket es público, usar URL directa
  if (typeof B2_PUBLIC_URL !== 'undefined' && B2_PUBLIC_URL) {
    return `${B2_PUBLIC_URL}/${bucketKey}`
  }
  
  // URL estándar de B2 S3-compatible
  const endpoint = typeof B2_ENDPOINT !== 'undefined' ? B2_ENDPOINT : 's3.us-west-004.backblazeb2.com'
  return `https://${B2_BUCKET_NAME}.${endpoint}/${bucketKey}`
}

// Parsear documento de Firestore a objeto JavaScript
function parseFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null
  
  const result = {}
  
  for (const [key, value] of Object.entries(doc.fields)) {
    // Extraer el valor según el tipo de Firestore
    if (value.stringValue !== undefined) {
      result[key] = value.stringValue
    } else if (value.integerValue !== undefined) {
      result[key] = parseInt(value.integerValue)
    } else if (value.doubleValue !== undefined) {
      result[key] = value.doubleValue
    } else if (value.booleanValue !== undefined) {
      result[key] = value.booleanValue
    } else if (value.timestampValue !== undefined) {
      // Convertir timestamp ISO a objeto con _seconds
      const date = new Date(value.timestampValue)
      result[key] = { _seconds: date.getTime() / 1000 }
    } else if (value.nullValue !== undefined) {
      result[key] = null
    } else if (value.referenceValue !== undefined) {
      result[key] = value.referenceValue
    }
  }
  
  return result
}

// Incrementar contador de descargas (async, no bloquea la respuesta)
async function incrementDownloadCount(token) {
  try {
    const url = `${BACKEND_URL}/api/shares/${token}/increment-counter`
    const response = await fetch(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!response.ok) {
      console.warn(`Failed to increment counter for ${token}: ${response.status}`)
    }
  } catch (error) {
    console.error(`Error incrementing counter for ${token}:`, error)
  }
}

// Helper para respuestas JSON
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }
  })
}
