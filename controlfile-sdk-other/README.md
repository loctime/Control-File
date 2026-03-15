# @controlfile/sdk

Standalone SDK for external applications that integrate with the ControlFile backend.

## Install

```bash
npm install @controlfile/sdk
```

## Create a client

```typescript
import { ControlFileClient } from '@controlfile/sdk';

const client = new ControlFileClient({
  baseUrl: 'https://api.controlfile.example',
  getAuthToken: async () => {
    const token = localStorage.getItem('authToken');

    if (!token) {
      throw new Error('Token no disponible');
    }

    return token;
  },
  options: {
    timeout: 30000,
    retries: 3,
  },
});
```

All SDK functionality is accessed through the client instance:

```typescript
client.files;
client.folders;
client.shares;
client.users;
client.appFiles;
```

## Files

```typescript
const page = await client.files.list({ parentId: null, pageSize: 50 });

const download = await client.files.getDownloadUrl('file_123');

await client.files.rename('file_123', 'nuevo-nombre.pdf');

await client.files.delete('file_123');
```

### Upload a file

```typescript
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput?.files?.[0];

if (!file) {
  throw new Error('No file selected');
}

const upload = await client.files.upload({
  file,
  name: file.name,
  parentId: 'folder_123',
  onProgress: (progress) => {
    console.log(`Upload: ${progress}%`);
  },
});
```

### Upload using a folder path

```typescript
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput?.files?.[0];

if (!file) {
  throw new Error('No file selected');
}

const upload = await client.files.uploadFile({
  file,
  path: ['app1', 'documentos', '2024'],
  userId: 'user_123',
});
```

## Folders

```typescript
const folderId = await client.folders.ensurePath({
  path: ['app1', 'documentos', '2024'],
  userId: 'user_123',
});
```

## Shares

```typescript
const share = await client.shares.create({
  fileId: 'file_123',
  expiresIn: 24,
});

const info = await client.shares.getInfo(share.shareToken);
const download = await client.shares.getDownloadUrl(share.shareToken);
const imageUrl = client.shares.getImageUrl(share.shareToken);
```

## Users

```typescript
const profile = await client.users.getProfile();

await client.users.updateProfile({
  displayName: 'Ada Lovelace',
  website: 'https://example.com',
});

const settings = await client.users.getSettings();

await client.users.updateTaskbar([
  { id: 'docs', name: 'Docs', type: 'folder', isCustom: true },
]);
```

## App files

`client.appFiles` creates scoped file modules for external apps.

```typescript
const appFiles = client.appFiles.forApp('controldoc', 'user_123');

await appFiles.ensurePath('documentos/aprobados');

await appFiles.uploadFile({
  file: new Blob(['hello']),
  path: ['documentos', 'aprobados'],
});

const listing = await appFiles.listFiles({ path: 'documentos' });
```

For backward compatibility, `client.forApp(appId, userId)` is kept as an alias of `client.appFiles.forApp(appId, userId)`.

## Error handling

```typescript
import {
  AuthenticationError,
  ControlFileError,
  NetworkError,
  NotFoundError,
  ValidationError,
} from '@controlfile/sdk';

try {
  await client.files.delete('file_123');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Token invalido o expirado');
  } else if (error instanceof NotFoundError) {
    console.error('Archivo no encontrado');
  } else if (error instanceof ValidationError) {
    console.error('Solicitud invalida');
  } else if (error instanceof NetworkError) {
    console.error('Error de red');
  } else if (error instanceof ControlFileError) {
    console.error(error.code, error.message);
  }
}
```

## Runtime support

- Browsers: modern browsers with `fetch`, `Blob`, `FormData`, and `XMLHttpRequest`
- Node.js: 18+ with the built-in Fetch API and `Blob`

Node uploads use `fetch`, so progress callbacks are best-effort in Node environments.

## Scripts

```bash
npm run build
npm run test
```
