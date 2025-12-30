# Contrato Técnico: Firestore Rules

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

**Fuente:** TRUTH.md §5.1

---

## Reglas activas

### `files/{fileId}`

```javascript
match /files/{fileId} {
  // READ público necesario para shares públicos vía Cloudflare Worker
  // El control de acceso real está en shares/{token} que valida expiración y estado
  // Los datos sensibles están en B2, no en Firestore
  allow read: if true;
  allow create: if isAuth() && request.resource.data.userId == uid();
  allow update, delete: if isAuth() && resource.data.userId == uid();
}
```

**Implicaciones:**
- Cualquier documento en `files` es legible públicamente
- No almacenar datos sensibles en `files`
- Ownership validado por `userId == uid()`

---

### `uploadSessions/{sessionId}`

```javascript
match /uploadSessions/{sessionId} {
  allow create: if isAuth() && request.resource.data.uid == uid();
  allow read, update, delete: if isAuth() && resource.data.uid == uid();
}
```

**Nota:** Usa `uid` (no `userId`).

---

### `shares/{shareId}`

```javascript
match /shares/{shareId} {
  allow read, write: if true;
}
```

**Implicaciones:**
- Público para lectura (necesario para validación de shares)
- Público para escritura (backend escribe sin auth)

---

### `users/{userId}`

```javascript
match /users/{userId} {
  allow create: if isAuth() && userId == uid();
  allow read, update, delete: if isAuth() && userId == uid();
}
```

**Nota:** El `userId` del path debe coincidir con `uid()`.

---

## Reglas legacy (no se usan)

### `folders/{folderId}`

```javascript
match /folders/{folderId} {
  allow create: if isAuth() && request.resource.data.userId == uid();
  allow read, update, delete: if isAuth() && resource.data.userId == uid();
}
```

**Estado:** Existe en `firestore-rules/controlFile.rules` pero NO se usa.  
Las carpetas están en `files` con `type: "folder"`.

---

## Referencias

- TRUTH.md §5.1
- 02_FILOSOFIA_Y_PRINCIPIOS.md §8.1
- 06_LEGACY_Y_EXCEPCIONES/folders_legacy.md

