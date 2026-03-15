import { ControlFileError, NetworkError } from '../errors.js';

export interface StorageUploadOptions {
  url: string;
  file: Blob;
  method?: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
  progressStart?: number;
  progressEnd?: number;
}

function filterUploadHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};

  Object.entries(headers).forEach(([key, value]) => {
    if (key.toLowerCase() === 'content-type') {
      return;
    }

    filtered[key] = value;
  });

  return filtered;
}

function normalizeUploadError(error: unknown): Error {
  if (error instanceof ControlFileError) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new NetworkError('Upload was aborted', error);
    }

    return new NetworkError(error.message || 'Upload failed due to network error', error);
  }

  return new NetworkError('Upload failed due to network error');
}

async function uploadWithFetch({
  url,
  file,
  method = 'PUT',
  headers = {},
  onProgress,
  progressEnd = 90,
}: StorageUploadOptions): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: filterUploadHeaders(headers),
    body: file,
  });

  if (!response.ok) {
    throw new ControlFileError(
      `Upload failed with status ${response.status}`,
      'UPLOAD_FAILED',
      response.status
    );
  }

  if (onProgress) {
    onProgress(progressEnd);
  }
}

function uploadWithXhr({
  url,
  file,
  method = 'PUT',
  headers = {},
  onProgress,
  progressStart = 10,
  progressEnd = 90,
}: StorageUploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const progressSpan = Math.max(progressEnd - progressStart, 0);

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }

      const uploadProgress = progressStart + ((event.loaded / event.total) * progressSpan);
      onProgress(Math.min(uploadProgress, progressEnd));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new ControlFileError(`Upload failed with status ${xhr.status}`, 'UPLOAD_FAILED', xhr.status));
    });

    xhr.addEventListener('error', () => {
      reject(new NetworkError('Upload failed due to network error'));
    });

    xhr.addEventListener('abort', () => {
      reject(new NetworkError('Upload was aborted'));
    });

    xhr.open(method, url);

    Object.entries(filterUploadHeaders(headers)).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.send(file);
  });
}

export async function uploadToStorage(options: StorageUploadOptions): Promise<void> {
  try {
    if (typeof XMLHttpRequest === 'function') {
      await uploadWithXhr(options);
      return;
    }

    await uploadWithFetch(options);
  } catch (error) {
    throw normalizeUploadError(error);
  }
}
