/**
 * Tests básicos para ControlFileClient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ControlFileClient } from '../client';
import {
  AuthenticationError,
  NotFoundError,
  QuotaExceededError,
} from '../errors';

// Mock global fetch
global.fetch = vi.fn();

describe('ControlFileClient', () => {
  const mockGetToken = vi.fn(async () => 'mock-token');
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Inicialización', () => {
    it('debe crear una instancia con configuración válida', () => {
      const client = new ControlFileClient({
        baseUrl,
        getAuthToken: mockGetToken,
      });

      expect(client).toBeDefined();
      expect(client.files).toBeDefined();
      expect(client.shares).toBeDefined();
    });

    it('debe aceptar opciones de configuración', () => {
      const client = new ControlFileClient({
        baseUrl,
        getAuthToken: mockGetToken,
        options: {
          timeout: 60000,
          retries: 5,
        },
      });

      expect(client).toBeDefined();
    });
  });

  describe('Files Module', () => {
    const client = new ControlFileClient({
      baseUrl,
      getAuthToken: mockGetToken,
    });

    describe('list', () => {
      it('debe listar archivos sin parámetros', async () => {
        const mockResponse = {
          items: [
            { id: 'file1', name: 'test.pdf', type: 'file' },
            { id: 'folder1', name: 'folder', type: 'folder' },
          ],
          nextPage: null,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.files.list();

        expect(result.items).toHaveLength(2);
        expect(result.nextPage).toBeNull();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/list'),
          expect.any(Object)
        );
      });

      it('debe listar archivos con parámetros de paginación', async () => {
        const mockResponse = {
          items: [],
          nextPage: 'cursor123',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.files.list({
          parentId: 'folder123',
          pageSize: 50,
          cursor: 'cursor123',
        });

        expect(result.nextPage).toBe('cursor123');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('parentId=folder123'),
          expect.any(Object)
        );
      });

      it('debe manejar respuesta con formato de cache', async () => {
        const mockResponse = {
          success: true,
          data: [{ id: 'file1', name: 'test.pdf', type: 'file' }],
          cacheHit: true,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.files.list();

        expect(result.items).toHaveLength(1);
      });
    });

    describe('getDownloadUrl', () => {
      it('debe obtener URL de descarga', async () => {
        const mockResponse = {
          success: true,
          downloadUrl: 'https://download.url/presigned',
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.files.getDownloadUrl('file123');

        expect(result.downloadUrl).toBe('https://download.url/presigned');
        expect(result.fileName).toBe('test.pdf');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/presign-get'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('delete', () => {
      it('debe eliminar un archivo', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

        await client.files.delete('file123');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/delete'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('debe lanzar NotFoundError si el archivo no existe', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Archivo no encontrado', code: 'NOT_FOUND' }),
        });

        await expect(client.files.delete('nonexistent')).rejects.toThrow(
          NotFoundError
        );
      });
    });

    describe('rename', () => {
      it('debe renombrar un archivo', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

        await client.files.rename('file123', 'new-name.pdf');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/files/rename'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Shares Module', () => {
    const client = new ControlFileClient({
      baseUrl,
      getAuthToken: mockGetToken,
    });

    describe('create', () => {
      it('debe crear un share link', async () => {
        const mockResponse = {
          shareToken: 'token123',
          shareUrl: 'https://share.url/token123',
          expiresAt: new Date().toISOString(),
          fileName: 'test.pdf',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.shares.create({ fileId: 'file123' });

        expect(result.shareToken).toBe('token123');
        expect(result.shareUrl).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/shares/create'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('debe aceptar expiresIn personalizado', async () => {
        const mockResponse = {
          shareToken: 'token123',
          shareUrl: 'https://share.url/token123',
          expiresAt: new Date().toISOString(),
          fileName: 'test.pdf',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        await client.shares.create({ fileId: 'file123', expiresIn: 48 });

        const callArgs = (global.fetch as any).mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        expect(body.expiresIn).toBe(48);
      });
    });

    describe('getInfo', () => {
      it('debe obtener información de share (público)', async () => {
        const mockResponse = {
          fileName: 'test.pdf',
          fileSize: 1024,
          mime: 'application/pdf',
          expiresAt: new Date().toISOString(),
          downloadCount: 5,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.shares.getInfo('token123');

        expect(result.fileName).toBe('test.pdf');
        expect(result.downloadCount).toBe(5);
        // No debe incluir Authorization header
        const callArgs = (global.fetch as any).mock.calls[0][1];
        expect(callArgs.headers).not.toHaveProperty('Authorization');
      });
    });

    describe('getImageUrl', () => {
      it('debe generar URL de imagen', () => {
        const url = client.shares.getImageUrl('token123');
        expect(url).toContain('/api/shares/token123/image');
      });

      it('debe aceptar baseUrl personalizado', () => {
        const customBase = 'https://custom.example.com';
        const url = client.shares.getImageUrl('token123', customBase);
        expect(url).toBe(`${customBase}/api/shares/token123/image`);
      });
    });
  });

  describe('Error Handling', () => {
    const client = new ControlFileClient({
      baseUrl,
      getAuthToken: mockGetToken,
    });

    it('debe lanzar AuthenticationError en 401', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No autorizado' }),
      });

      await expect(client.files.list()).rejects.toThrow(AuthenticationError);
    });

    it('debe lanzar QuotaExceededError en 413', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({
          error: 'Cuota excedida',
          usedBytes: 1000,
          planQuotaBytes: 500,
        }),
      });

      await expect(client.files.upload({
        file: new Blob(['test']),
        name: 'test.txt',
        parentId: null,
      })).rejects.toThrow(QuotaExceededError);
    });
  });
});
