// lib/b2.ts
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pRetry from 'p-retry';
import { logger } from './logger';

// Initialize S3 client for Backblaze B2
const s3Client = new S3Client({
  region: 'us-west-004',
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
  forcePathStyle: true,
  maxAttempts: 3, // Reintentos automáticos del SDK
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME!;
const MULTIPART_THRESHOLD = 128 * 1024 * 1024; // 128MB

// Configuración de reintentos
const RETRY_CONFIG = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 10000,
  onFailedAttempt: (error: any) => {
    logger.warn('B2 operation retry', {
      attempt: error.attemptNumber,
      retriesLeft: error.retriesLeft,
      error: error.message,
    });
  },
};

/**
 * Helper para ejecutar operaciones con reintentos automáticos
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return pRetry(async () => {
    try {
      return await operation();
    } catch (error: any) {
      logger.error(`B2 ${operationName} failed`, {
        error: error.message,
        code: error.code,
      });
      
      // No reintentar ciertos errores
      if (error.code === 'NotFound' || error.code === 'AccessDenied') {
        throw new pRetry.AbortError(error);
      }
      
      throw error;
    }
  }, RETRY_CONFIG);
}

// Generate presigned URL for upload
export async function createPresignedPutUrl(
  key: string,
  expiresIn: number = 3600,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Generate presigned POST URL for form upload (simplified version)
export async function createPresignedPostUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<{ url: string; fields: Record<string, string> }> {
  // For simplicity, we'll use PUT URL instead of POST
  // This works for most upload scenarios
  const putUrl = await createPresignedPutUrl(key, expiresIn, contentType);
  
  return {
    url: putUrl,
    fields: {
      key,
      'Content-Type': contentType,
    }
  };
}

// Generate presigned URL for download
export async function createPresignedGetUrl(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Delete object from B2 with retry
export async function deleteObject(key: string): Promise<void> {
  return withRetry(async () => {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    logger.info('B2 object deleted', { key });
  }, 'deleteObject');
}

// Get object metadata with retry
export async function getObjectMetadata(key: string) {
  return withRetry(async () => {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    try {
      const response = await s3Client.send(command);
      const metadata = {
        size: response.ContentLength || 0,
        etag: response.ETag?.replace(/"/g, '') || '',
        lastModified: response.LastModified,
        contentType: response.ContentType,
      };
      logger.debug('B2 metadata retrieved', { key, size: metadata.size });
      return metadata;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        logger.debug('B2 object not found', { key });
        return null;
      }
      throw error;
    }
  }, 'getObjectMetadata');
}

// Multipart upload utilities
export async function createMultipartUpload(
  key: string,
  contentType?: string
): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  if (!response.UploadId) {
    throw new Error('Failed to create multipart upload');
  }

  return response.UploadId;
}

export async function createPresignedUploadPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn: number = 3600
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3Client.send(command);
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}

// Calculate multipart upload configuration
export function calculateMultipartConfig(fileSize: number) {
  if (fileSize < MULTIPART_THRESHOLD) {
    return null; // Use regular upload
  }

  const maxParts = 10000; // B2 limit
  const minPartSize = 5 * 1024 * 1024; // 5MB minimum
  const maxPartSize = 5 * 1024 * 1024 * 1024; // 5GB maximum

  let partSize = Math.ceil(fileSize / maxParts);
  partSize = Math.max(partSize, minPartSize);
  partSize = Math.min(partSize, maxPartSize);

  const totalParts = Math.ceil(fileSize / partSize);

  return {
    partSize,
    totalParts,
    useMultipart: true,
  };
}

// List objects with prefix (for reconciliation)
export async function listObjects(prefix: string, maxKeys: number = 1000) {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await s3Client.send(command);
  return {
    objects: response.Contents || [],
    isTruncated: response.IsTruncated || false,
    continuationToken: response.NextContinuationToken,
  };
}

// Get download authorization for Cloudflare Worker
export async function getDownloadAuthorization(
  keyPrefix: string,
  validDurationInSeconds: number = 86400
) {
  // This would typically use B2's native API for download authorization
  // For simplicity, we'll use presigned URLs which work with the S3-compatible API
  return {
    authorizationToken: 'not_needed_with_presigned_urls',
    keyPrefix,
    validUntil: new Date(Date.now() + validDurationInSeconds * 1000),
  };
}