// lib/schemas/api-schemas.ts - Schemas de validación para APIs
import { z } from 'zod';

// Schemas comunes
export const fileIdSchema = z.string().min(1, 'ID de archivo requerido');
export const folderIdSchema = z.string().min(1, 'ID de carpeta requerido');
export const userIdSchema = z.string().min(1, 'ID de usuario requerido');

// Schema para nombres de archivo
export const fileNameSchema = z
  .string()
  .min(1, 'Nombre de archivo requerido')
  .max(255, 'Nombre de archivo muy largo')
  .refine(
    (name) => !name.includes('/') && !name.includes('\\'),
    'El nombre no puede contener barras'
  );

// Schema para MIME types
export const mimeTypeSchema = z
  .string()
  .regex(/^[a-z]+\/[a-z0-9-+.]+$/i, 'Tipo MIME inválido');

// Schema para tamaño de archivo
export const fileSizeSchema = z
  .number()
  .positive('El tamaño debe ser positivo')
  .max(5 * 1024 * 1024 * 1024, 'Archivo muy grande (máx. 5GB)');

// ========== UPLOAD SCHEMAS ==========

export const uploadPresignSchema = z.object({
  name: fileNameSchema,
  size: fileSizeSchema,
  mime: mimeTypeSchema,
  parentId: z.string().nullable().optional(),
});

export const uploadConfirmSchema = z.object({
  uploadSessionId: z.string().min(1, 'ID de sesión requerido'),
  etag: z.string().optional(),
  parts: z.array(
    z.object({
      PartNumber: z.number().int().positive(),
      ETag: z.string(),
    })
  ).optional(),
});

// ========== FILE SCHEMAS ==========

export const fileDeleteSchema = z.object({
  fileId: fileIdSchema,
});

export const fileRenameSchema = z.object({
  fileId: fileIdSchema,
  newName: fileNameSchema,
});

export const filePresignGetSchema = z.object({
  fileId: fileIdSchema,
});

export const fileMoveSchema = z.object({
  fileId: fileIdSchema,
  newParentId: z.string().nullable(),
});

export const fileRestoreSchema = z.object({
  fileId: fileIdSchema,
});

// ========== FOLDER SCHEMAS ==========

export const folderCreateSchema = z.object({
  id: z.string().min(1, 'ID requerido'),
  name: fileNameSchema,
  parentId: z.string().nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  source: z.string().optional(),
  appCode: z.string().optional(),
});

export const folderDeleteSchema = z.object({
  folderId: folderIdSchema,
  permanent: z.boolean().optional().default(false),
});

// ========== SHARE SCHEMAS ==========

export const shareCreateSchema = z.object({
  fileId: fileIdSchema,
  expiresIn: z.number().int().positive().max(30).optional().default(7),
});

export const shareRevokeSchema = z.object({
  shareId: z.string().min(1, 'ID de compartido requerido'),
});

// ========== USER SCHEMAS ==========

export const userSettingsUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['es', 'en']).optional(),
  defaultView: z.enum(['grid', 'list']).optional(),
});

export const userProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3, 'Username muy corto')
    .max(30, 'Username muy largo')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Username solo puede contener letras minúsculas, números y guiones (no al inicio/fin)'
    )
    .optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  location: z.string().max(100).optional(),
  isPublic: z.boolean().optional(),
});

// ========== BILLING SCHEMAS ==========

export const checkoutSchema = z.object({
  planId: z.string().min(1, 'ID de plan requerido'),
  interval: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

// Type exports para TypeScript
export type UploadPresignInput = z.infer<typeof uploadPresignSchema>;
export type UploadConfirmInput = z.infer<typeof uploadConfirmSchema>;
export type FileDeleteInput = z.infer<typeof fileDeleteSchema>;
export type FileRenameInput = z.infer<typeof fileRenameSchema>;
export type FolderCreateInput = z.infer<typeof folderCreateSchema>;
export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
export type UserSettingsUpdateInput = z.infer<typeof userSettingsUpdateSchema>;
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

