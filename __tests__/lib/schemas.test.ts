// __tests__/lib/schemas.test.ts
import { describe, it, expect } from 'vitest';
import {
  uploadPresignSchema,
  uploadConfirmSchema,
  fileDeleteSchema,
  folderCreateSchema,
  shareCreateSchema,
  userProfileUpdateSchema,
  checkoutSchema,
} from '@/lib/schemas/api-schemas';

describe('API Schemas Validation', () => {
  describe('uploadPresignSchema', () => {
    it('should validate correct upload data', () => {
      const validData = {
        name: 'test-file.pdf',
        size: 1024 * 1024, // 1MB
        mime: 'application/pdf',
        parentId: null,
      };

      const result = uploadPresignSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject file name with slashes', () => {
      const invalidData = {
        name: '../../../etc/passwd',
        size: 1024,
        mime: 'text/plain',
      };

      const result = uploadPresignSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject file too large', () => {
      const invalidData = {
        name: 'huge-file.zip',
        size: 6 * 1024 * 1024 * 1024, // 6GB
        mime: 'application/zip',
      };

      const result = uploadPresignSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid MIME type', () => {
      const invalidData = {
        name: 'file.txt',
        size: 1024,
        mime: 'invalid-mime',
      };

      const result = uploadPresignSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('folderCreateSchema', () => {
    it('should validate correct folder data', () => {
      const validData = {
        id: 'folder-123',
        name: 'My Documents',
        parentId: null,
        icon: 'Folder',
        color: 'text-blue-600',
      };

      const result = folderCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject folder name too long', () => {
      const invalidData = {
        id: 'folder-123',
        name: 'a'.repeat(256),
        parentId: null,
      };

      const result = folderCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('shareCreateSchema', () => {
    it('should validate correct share data', () => {
      const validData = {
        fileId: 'file-123',
        expiresIn: 7,
      };

      const result = shareCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default expiresIn value', () => {
      const data = {
        fileId: 'file-123',
      };

      const result = shareCreateSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresIn).toBe(7);
      }
    });

    it('should reject expiresIn too large', () => {
      const invalidData = {
        fileId: 'file-123',
        expiresIn: 31,
      };

      const result = shareCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('userProfileUpdateSchema', () => {
    it('should validate correct profile data', () => {
      const validData = {
        displayName: 'John Doe',
        username: 'johndoe',
        bio: 'Software developer',
        website: 'https://example.com',
      };

      const result = userProfileUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid username', () => {
      const invalidData = {
        username: 'John Doe', // Espacios no permitidos
      };

      const result = userProfileUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject username starting with hyphen', () => {
      const invalidData = {
        username: '-johndoe',
      };

      const result = userProfileUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid website URL', () => {
      const invalidData = {
        website: 'not-a-url',
      };

      const result = userProfileUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept empty website', () => {
      const validData = {
        website: '',
      };

      const result = userProfileUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('checkoutSchema', () => {
    it('should validate correct checkout data', () => {
      const validData = {
        planId: 'pro',
        interval: 'monthly' as const,
      };

      const result = checkoutSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default interval', () => {
      const data = {
        planId: 'pro',
      };

      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interval).toBe('monthly');
      }
    });

    it('should reject invalid interval', () => {
      const invalidData = {
        planId: 'pro',
        interval: 'weekly',
      };

      const result = checkoutSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

