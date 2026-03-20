# ControlFile – Data Models

> Source: TRUTH.md (authoritative)
> All field names here are canonical. Do not use alternative names.

---

## Overview

ControlFile uses **four Firestore collections**:

| Collection | Purpose |
|---|---|
| `files` | All files and folders (unified, `type` field differentiates) |
| `shares` | Public share links, indexed by token |
| `uploadSessions` | Temporary upload state during 3-step upload flow |
| `users` | Per-user quota and plan data |

---

## `files` Collection

The central collection. Stores all user files and folders in a flat structure with hierarchy expressed via `parentId` and `ancestors`.

### File Document (`type: "file"`)

```typescript
interface FileDocument {
  // Identity
  id: string;                    // Firestore document ID
  userId: string;                // Firebase UID of owner
  type: "file";                  // Always "file" for files

  // Content metadata
  name: string;                  // Display name (e.g. "report.pdf")
  size: number;                  // Size in bytes
  mime: string;                  // MIME type (e.g. "application/pdf")
  bucketKey: string;             // B2 object path — canonical storage identifier
                                 // Format: "users/{userId}/files/{timestamp}-{name}"

  // Hierarchy
  parentId: string | null;       // Parent folder doc ID. null = root
  path: string;                  // Full human-readable path
  ancestors: string[];           // Ordered array of ancestor folder IDs

  // Timestamps
  createdAt: Timestamp;          // Creation time
  updatedAt: Timestamp;          // Last modification time
  deletedAt: Timestamp | null;   // null = active. Non-null = soft-deleted (in trash)

  // Optional
  etag?: string;                 // B2 ETag for integrity verification
}
```

### Folder Document (`type: "folder"`)

```typescript
interface FolderDocument {
  // Identity
  id: string;                    // Firestore document ID
  userId: string;                // Firebase UID of owner
  type: "folder";                // Always "folder" for folders

  // Content metadata
  name: string;                  // Display name (e.g. "My Documents")
  slug: string;                  // URL-friendly name (e.g. "my-documents")

  // Hierarchy
  parentId: string | null;       // Parent folder doc ID. null = root
  path: string;                  // Full human-readable path
  ancestors: string[];           // Ordered array of ancestor folder IDs

  // Timestamps
  createdAt: Timestamp;
  modifiedAt: Timestamp;         // Preferred. "updatedAt" also accepted by code.
  deletedAt: Timestamp | null;   // null = active. Non-null = soft-deleted
}
```

### Field Name Rules

| Canonical name | Deprecated/wrong alternatives | Notes |
|---|---|---|
| `userId` | `uid` (in files) | Ownership field in `files` collection |
| `bucketKey` | `b2Key`, `objectKey`, `key` | Never use alternatives |
| `planQuotaBytes` | `quotaBytes` | In `users` collection |
| `modifiedAt` | — | `updatedAt` also accepted for folders but `modifiedAt` preferred |
| `deletedAt` | — | Soft-delete marker. Always present, nullable |

---

## `shares` Collection

Public share links. Document ID equals the share token.

```typescript
interface ShareDocument {
  // Identity
  token: string;                      // Random, non-predictable token (= document ID)
  fileId: string;                     // Reference to files/{fileId}
  uid: string;                        // Firebase UID of share creator

  // Denormalized file metadata (cached at share creation time)
  fileName: string;                   // File name
  fileSize: number;                   // File size in bytes
  mime: string;                       // MIME type

  // Access control
  isActive: boolean;                  // false = revoked
  expiresAt: Timestamp | null;        // null = never expires

  // Timestamps
  createdAt: Timestamp;
  downloadCount: number;              // Total number of downloads

  // Optional
  virusScanned?: boolean;             // Whether virus scan was performed
  revokedReason?: string;             // Human-readable revocation reason
  revokedAt?: Timestamp;             // When the share was revoked
  lastDownloadAt?: Timestamp;        // Timestamp of most recent download

  // Legacy (read-only compatibility)
  isPublic?: boolean;                 // LEGACY — read for backwards compat only
                                      // Do NOT write this field in new code
}
```

### Share Validity Check

A share is valid when ALL of the following are true:
```
document exists
AND isActive !== false
AND (expiresAt === null OR expiresAt > Date.now())
AND (isPublic === undefined OR isPublic !== false)  // legacy compat
```

---

## `uploadSessions` Collection

Temporary documents created during the upload flow. Sessions expire after **24 hours**.

```typescript
interface UploadSessionDocument {
  // Identity
  uid: string;                        // Firebase UID of uploader

  // File being uploaded
  bucketKey: string;                  // Target B2 object path
  size: number;                       // Expected file size in bytes
  name: string;                       // File name
  mime: string;                       // MIME type

  // State
  status: "pending" | "uploaded" | "completed";
  expiresAt: Timestamp;              // Session TTL (24 hours from creation)
  createdAt: Timestamp;

  // Optional
  parentId?: string | null;          // Target folder ID in `files` collection
  uploadId?: string;                 // B2 multipart upload ID (multipart only)
  ancestors?: string[];              // Ancestor folder IDs
  completedAt?: Timestamp;           // Set when status = "completed"
}
```

### Status Lifecycle

```
"pending"   → Upload session created, presigned URL generated
"uploaded"  → File uploaded to B2 (intermediate state)
"completed" → Confirm called, files/{id} created
```

---

## `users` Collection

Per-user quota and plan tracking. Document ID equals the Firebase UID.

```typescript
interface UserDocument {
  planQuotaBytes: number;   // Total quota in bytes (e.g. 1073741824 = 1 GB)
  usedBytes: number;        // Bytes used by active (non-trashed) files
  pendingBytes: number;     // Bytes reserved for in-progress uploads
  planId: string;           // Current plan identifier (e.g. "free", "pro")
}
```

### Quota Accounting

| Event | `usedBytes` | `pendingBytes` |
|---|---|---|
| `POST /uploads/presign` | — | += `size` |
| `POST /uploads/confirm` | += `size` | -= `size` |
| `POST /files/delete` (soft) | -= `size` | — |
| `POST /files/restore` | += `size` | — |
| `POST /files/permanent-delete` | — (already decremented) | — |
| `POST /files/empty-trash` | -= `sum(sizes)` | — |

**Validation formula (enforced before presign):**
```
usedBytes + pendingBytes + newFileSize <= planQuotaBytes
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function uid() {
      return request.auth.uid;
    }

    // Files and folders — unified collection
    // allow read: if true enables Cloudflare Worker share access
    // Real security is in the backend (ownership checks)
    // No sensitive data should be stored in this collection
    match /files/{fileId} {
      allow read: if true;
      allow create: if isAuth() && request.resource.data.userId == uid();
      allow update, delete: if isAuth() && resource.data.userId == uid();
    }

    // LEGACY — not actively used. Folders are in `files` collection.
    match /folders/{folderId} {
      allow create: if isAuth() && request.resource.data.userId == uid();
      allow read, update, delete: if isAuth() && resource.data.userId == uid();
    }

    // Upload sessions
    match /uploadSessions/{sessionId} {
      allow create: if isAuth() && request.resource.data.uid == uid();
      allow read, update, delete: if isAuth() && resource.data.uid == uid();
    }

    // Shares — fully public (security via token knowledge)
    match /shares/{shareId} {
      allow read, write: if true;
    }

    // Users — private to owner
    match /users/{userId} {
      allow create: if isAuth() && userId == uid();
      allow read, update, delete: if isAuth() && userId == uid();
    }
  }
}
```

### Security Model Explanation

| Collection | Read | Write |
|---|---|---|
| `files` | Public (metadata only) | Owner only |
| `folders` | Owner only (legacy) | Owner only (legacy) |
| `uploadSessions` | Owner only | Owner only |
| `shares` | Public | Public (backend enforces logic) |
| `users` | Owner only | Owner only |

The `files` collection is intentionally public-read because:
1. Cloudflare Workers need to read file metadata to serve shares
2. The actual file content is in B2, protected by presigned URLs and share token validation
3. No sensitive data should be stored in `files` documents

The `shares` collection is fully public because the token is the access credential — knowing the token means you should have access.

---

## Ownership Fields by Collection

| Collection | Owner field | Value |
|---|---|---|
| `files` | `userId` | Firebase UID |
| `shares` | `uid` | Firebase UID |
| `uploadSessions` | `uid` | Firebase UID |
| `users` | document ID | Firebase UID |

Note the inconsistency: `files` uses `userId` while `shares` and `uploadSessions` use `uid`. This is a historical design decision. Do not normalize these without updating all code.
