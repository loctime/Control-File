/**
 * Helpers para construcción de URLs públicas
 * No expuestas directamente, pero usadas por los módulos públicos
 */

export function buildShareUrl(token: string, baseUrl: string): string {
  // Construir URL pública de share
  // Formato: {baseUrl}/share/{token}
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}/share/${token}`;
}

export function buildImageUrl(token: string, baseUrl: string): string {
  // Construir URL de imagen directa para <img> tags
  // Formato: {baseUrl}/api/shares/{token}/image
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}/api/shares/${token}/image`;
}
