// Cloudflare Worker for serving shared files
// This worker acts as a CDN for shared files with caching

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Handle share requests
  if (url.pathname === '/share') {
    return handleShareRequest(request)
  }
  
  // Handle health check
  if (url.pathname === '/health') {
    return new Response('OK', { status: 200 })
  }
  
  return new Response('Not Found', { status: 404 })
}

async function handleShareRequest(request) {
  const url = new URL(request.url)
  const shareId = url.searchParams.get('s')
  
  if (!shareId) {
    return new Response('Share ID required', { status: 400 })
  }
  
  try {
    // Get share information from Firestore
    const shareData = await getShareData(shareId)
    
    if (!shareData) {
      return new Response('Share not found', { status: 404 })
    }
    
    // Check if share is expired
    if (shareData.expiresAt && new Date(shareData.expiresAt) < new Date()) {
      return new Response('Share expired', { status: 410 })
    }
    
    // Get file information
    const fileData = await getFileData(shareData.fileId)
    
    if (!fileData) {
      return new Response('File not found', { status: 404 })
    }
    
    // Generate presigned URL for B2
    const downloadUrl = await generateB2DownloadUrl(fileData.bucketKey)
    
    // Fetch file from B2
    const response = await fetch(downloadUrl)
    
    if (!response.ok) {
      return new Response('File not available', { status: 404 })
    }
    
    // Create response with appropriate headers
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'public, max-age=86400, immutable')
    headers.set('Content-Disposition', `inline; filename="${fileData.name}"`)
    
    // Add custom headers for cache invalidation
    headers.set('X-Share-Id', shareId)
    headers.set('X-Revocation-Counter', shareData.revocationCounter.toString())
    
    return new Response(response.body, {
      status: response.status,
      headers: headers
    })
    
  } catch (error) {
    console.error('Error handling share request:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

async function getShareData(shareId) {
  // This would typically use Firestore REST API
  // For now, we'll return a mock response
  // In production, you'd make an authenticated request to Firestore
  
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/shares/${shareId}`
  
  try {
    const response = await fetch(firestoreUrl, {
      headers: {
        'Authorization': `Bearer ${FIREBASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.fields
  } catch (error) {
    console.error('Error fetching share data:', error)
    return null
  }
}

async function getFileData(fileId) {
  // Similar to getShareData, but for files
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/files/${fileId}`
  
  try {
    const response = await fetch(firestoreUrl, {
      headers: {
        'Authorization': `Bearer ${FIREBASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.fields
  } catch (error) {
    console.error('Error fetching file data:', error)
    return null
  }
}

async function generateB2DownloadUrl(bucketKey) {
  // This would use B2's download authorization API
  // For now, we'll use a presigned URL approach
  
  const b2Url = `https://s3.us-west-004.backblazeb2.com/${B2_BUCKET_NAME}/${bucketKey}`
  
  // In production, you'd generate a proper presigned URL
  // This is a simplified version
  return b2Url
}

// Environment variables (set in Cloudflare dashboard)
const FIREBASE_PROJECT_ID = 'your-firebase-project-id'
const FIREBASE_ACCESS_TOKEN = 'your-firebase-access-token'
const B2_BUCKET_NAME = 'your-b2-bucket-name'
