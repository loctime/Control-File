// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { getAuth } from 'firebase/auth'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Date formatting
export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) {
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else if (daysDiff === 1) {
    return 'Ayer';
  } else if (daysDiff < 7) {
    return `Hace ${daysDiff} días`;
  } else {
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }
}

// MIME type utilities
export function getMimeTypeIcon(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'music';
  if (mime === 'application/pdf') return 'file-text';
  if (mime.includes('word') || mime.includes('document')) return 'file-text';
  if (mime.includes('sheet') || mime.includes('excel')) return 'sheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return 'archive';
  return 'file';
}

export function isImageFile(mime: string): boolean {
  return mime.startsWith('image/');
}

export function isPDFFile(mime: string): boolean {
  return mime === 'application/pdf';
}

export function isVideoFile(mime: string): boolean {
  return mime.startsWith('video/');
}

export function isAudioFile(mime: string): boolean {
  return mime.startsWith('audio/');
}

export function isTextFile(mime: string): boolean {
  return mime.startsWith('text/') || 
         mime === 'application/json' || 
         mime === 'application/xml' ||
         mime === 'application/javascript' ||
         mime === 'application/typescript' ||
         mime === 'application/x-python' ||
         mime === 'application/x-java-source' ||
         mime === 'application/x-c++src' ||
         mime === 'application/x-csrc' ||
         mime === 'application/x-php' ||
         mime === 'application/x-ruby' ||
         mime === 'application/x-go' ||
         mime === 'application/x-rust' ||
         mime === 'application/x-swift' ||
         mime === 'application/x-kotlin' ||
         mime === 'application/x-scala' ||
         mime === 'application/x-clojure' ||
         mime === 'application/x-haskell' ||
         mime === 'application/x-ocaml' ||
         mime === 'application/x-fsharp' ||
         mime === 'application/x-erlang' ||
         mime === 'application/x-elixir' ||
         mime === 'application/x-dart' ||
         mime === 'application/x-r' ||
         mime === 'application/x-matlab' ||
         mime === 'application/x-octave' ||
         mime === 'application/x-sql' ||
         mime === 'application/x-yaml' ||
         mime === 'application/x-toml' ||
         mime === 'application/x-ini' ||
         mime === 'application/x-csv' ||
         mime === 'application/x-tsv' ||
         mime === 'application/x-markdown' ||
         mime === 'application/x-asciidoc' ||
         mime === 'application/x-restructuredtext' ||
         mime === 'application/x-latex' ||
         mime === 'application/x-tex' ||
         mime === 'application/x-bibtex' ||
         mime === 'application/x-log';
}

export function isOfficeFile(mime: string): boolean {
  return mime.includes('word') || 
         mime.includes('document') ||
         mime.includes('excel') || 
         mime.includes('spreadsheet') ||
         mime.includes('powerpoint') || 
         mime.includes('presentation') ||
         mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
         mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
         mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
         mime === 'application/vnd.ms-word.document.12' ||
         mime === 'application/vnd.ms-excel.sheet.12' ||
         mime === 'application/vnd.ms-powerpoint.presentation.12' ||
         mime === 'application/msword' ||
         mime === 'application/vnd.ms-excel' ||
         mime === 'application/vnd.ms-powerpoint';
}

// Path utilities
export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');
}

export function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

export function getFileName(path: string): string {
  return path.split('/').pop() || '';
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateFileName(name: string): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'El nombre no puede estar vacío' };
  }
  
  if (name.length > 255) {
    return { valid: false, error: 'El nombre es demasiado largo (máx. 255 caracteres)' };
  }
  
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(name)) {
    return { valid: false, error: 'El nombre contiene caracteres no válidos' };
  }
  
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reservedNames.includes(name.toUpperCase())) {
    return { valid: false, error: 'Nombre reservado del sistema' };
  }
  
  return { valid: true };
}

// Quota utilities
export function getQuotaPercentage(used: number, total: number): number {
  return Math.min((used / total) * 100, 100);
}

export function getQuotaColor(percentage: number): string {
  if (percentage < 50) return 'bg-green-500';
  if (percentage < 75) return 'bg-yellow-500';
  if (percentage < 90) return 'bg-orange-500';
  return 'bg-red-500';
}

// Upload utilities
export function chunkFile(file: File, chunkSize: number = 5 * 1024 * 1024): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    chunks.push(chunk);
    offset += chunkSize;
  }
  
  return chunks;
}

export function generateFileKey(userId: string, parentPath: string, fileName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const sanitizedName = sanitizeFileName(fileName);
  return joinPath(userId, parentPath, `${timestamp}_${random}_${sanitizedName}`);
}

// Keyboard shortcuts
export function isKeyboardShortcut(
  event: KeyboardEvent,
  shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }
): boolean {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    !!event.ctrlKey === !!shortcut.ctrl &&
    !!event.shiftKey === !!shortcut.shift &&
    !!event.altKey === !!shortcut.alt
  );
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// API utilities
export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Intentar agregar token de Firebase si existe
  let authHeader: Record<string, string> = {};
  try {
    if (typeof window !== 'undefined') {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        authHeader = { 'Authorization': `Bearer ${token}` };
      }
    }
  } catch (_) {}

  const response = await fetch(`/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = (error && (error.message || error.error)) || `Error ${response.status}`;
    throw new Error(message);
  }
  
  return response.json();
}

// Backend API utilities
export async function backendApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';
  
  // Merge headers properly, allowing custom headers to override defaults
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  console.log('🌐 Backend API call to:', `${backendUrl}/api${endpoint}`);
  console.log('🌐 Headers:', headers);
  console.log('🌐 Body:', options.body);
  
  const response = await fetch(`${backendUrl}/api${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(error.message || `Error ${response.status}`);
  }
  
  return response.json();
}

// Error handling
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Ha ocurrido un error inesperado';
}