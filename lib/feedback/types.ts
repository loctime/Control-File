import { Timestamp } from 'firebase/firestore';

/**
 * Estados del feedback
 */
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'archived';

/**
 * Acciones del historial de feedback
 */
export type FeedbackHistoryAction =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'note_added'
  | 'resolved'
  | 'archived';

/**
 * Entrada del historial de feedback
 */
export interface FeedbackHistoryEntry {
  action: FeedbackHistoryAction;
  performedBy: string; // UID
  timestamp: Timestamp;
  changes?: {
    before?: any;
    after?: any;
  };
  reason?: string;
}

/**
 * Contexto técnico del feedback
 */
export interface FeedbackContext {
  page: {
    url: string; // URL completa de la página
    route: string; // Ruta de la aplicación
  };
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
    dpr: number; // Device pixel ratio
  };
  selection?: {
    // Opcional: área seleccionada (para fase 2)
    x: number;
    y: number;
    width: number;
    height: number;
  };
  source?: {
    // Opcional: información de origen
    appVersion?: string;
    build?: string;
  };
}

/**
 * Documento de feedback en Firestore
 */
export interface FeedbackDocument {
  // Identificadores
  feedbackId: string; // ID único del feedback (generado: feedback_{timestamp}_{random})
  appId: string; // App que generó el feedback (ej: 'controlaudit') - REQUERIDO
  tenantId: string | null; // Tenant opcional - VER REGLAS EN SECCIÓN 6

  // Usuario y contexto
  userId: string; // UID del usuario que creó el feedback
  userRole?: string; // Rol del usuario en la app externa (informativo)
  createdBy: string; // UID (igual a userId, para consistencia)

  // Contenido
  comment: string; // Comentario del usuario
  screenshotFileId: string; // ID del archivo en colección 'files'

  // Contexto técnico
  context: FeedbackContext;

  // Idempotencia
  clientRequestId?: string; // ID opcional del cliente para prevenir duplicados

  // Estado y gestión
  status: FeedbackStatus;
  assignedTo?: string | null; // UID del usuario asignado (opcional)
  internalNotes?: string; // Notas internas del equipo

  // Metadatos
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
  archivedAt?: Timestamp;

  // Auditoría
  history: FeedbackHistoryEntry[]; // Array embebido - VER NOTA DE DISEÑO EN RFC
}

/**
 * Payload para crear feedback
 */
export interface CreateFeedbackPayload {
  appId: string;
  tenantId?: string | null;
  userRole?: string;
  comment: string;
  context: FeedbackContext;
  clientRequestId?: string;
}

/**
 * Filtros para listar feedback
 */
export interface FeedbackFilters {
  appId: string; // required
  tenantId?: string | null;
  status?: FeedbackStatus;
  createdBy?: string; // UID
  assignedTo?: string; // UID
  fromDate?: number; // timestamp
  toDate?: number; // timestamp
}

/**
 * Paginación para listar feedback
 */
export interface FeedbackPagination {
  cursor?: string; // ID del último documento
  pageSize?: number; // default: 20, max: 100
}

/**
 * Resultado de listado de feedback
 */
export interface FeedbackListResult {
  items: FeedbackDocument[];
  pagination: {
    pageSize: number;
    hasMore: boolean;
    cursor?: string;
  };
}

/**
 * Actualización de feedback
 */
export interface UpdateFeedbackPayload {
  status?: FeedbackStatus;
  assignedTo?: string | null;
  internalNotes?: string;
}
