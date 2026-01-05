# Automatizaciones Platform (Opcional - Fase 2)

Este documento describe las automatizaciones suaves que pueden implementarse para la capa platform.

## Implementación

Las automatizaciones deben ejecutarse como Cloud Functions o Scheduled Tasks (cron jobs).

## Reglas de Automatización

### 1. Overdue → Warning

**Condición:**
- `paidUntil < now`
- `status === 'active'`

**Acción:**
- Cambiar `status` a `'warning'`
- Estado `warning` permite acceso completo pero con notificaciones
- Opcional: Enviar email de notificación

**Override:** Siempre permitir override manual desde Owner Console

### 2. Overdue grave → Suspended

**Condición:**
- `paidUntil < now - 7 days`
- `status === 'warning'`

**Acción:**
- Cambiar `status` a `'suspended'`
- Estado `suspended` bloquea acceso completamente (las apps deben validar)

**Override:** Siempre permitir override manual desde Owner Console

### 3. Trial expired → Expired

**Condición:**
- `trialEndsAt < now`
- `status === 'trial'`

**Acción:**
- Cambiar `status` a `'expired'`
- Estado `expired` permite read-only (las apps deben bloquear write actions)
- Mantener apps habilitadas pero en modo read-only (lógica en apps)

**Override:** Siempre permitir override manual desde Owner Console

## Estructura de Cloud Function (Ejemplo)

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { requireAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase/firestore';
import { createAuditLog } from '@/lib/platform/audit';

export const checkOverdueAccounts = onSchedule('every 24 hours', async (event) => {
  const db = requireAdminDb();
  const now = Timestamp.now();
  const sevenDaysAgo = Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

  // Obtener cuentas activas con paidUntil vencido
  const activeOverdueQuery = db.collection('platform')
    .doc('accounts')
    .collection('accounts')
    .where('status', '==', 'active')
    .where('paidUntil', '<', now);

  const activeOverdueSnap = await activeOverdueQuery.get();
  
  for (const doc of activeOverdueSnap.docs) {
    const account = doc.data();
    await doc.ref.update({ status: 'warning' });
    
    await createAuditLog(
      'account.automation_warning',
      'system',
      { before: { status: 'active' }, after: { status: 'warning' } },
      { targetUid: account.uid, reason: 'Overdue payment - automated warning' }
    );
  }

  // Obtener cuentas en warning con paidUntil vencido hace más de 7 días
  const warningOverdueQuery = db.collection('platform')
    .doc('accounts')
    .collection('accounts')
    .where('status', '==', 'warning')
    .where('paidUntil', '<', sevenDaysAgo);

  const warningOverdueSnap = await warningOverdueQuery.get();
  
  for (const doc of warningOverdueSnap.docs) {
    const account = doc.data();
    await doc.ref.update({ status: 'suspended' });
    
    await createAuditLog(
      'account.automation_suspend',
      'system',
      { before: { status: 'warning' }, after: { status: 'suspended' } },
      { targetUid: account.uid, reason: 'Overdue payment > 7 days - automated suspension' }
    );
  }

  // Obtener trials expirados
  const expiredTrialsQuery = db.collection('platform')
    .doc('accounts')
    .collection('accounts')
    .where('status', '==', 'trial')
    .where('trialEndsAt', '<', now);

  const expiredTrialsSnap = await expiredTrialsQuery.get();
  
  for (const doc of expiredTrialsSnap.docs) {
    const account = doc.data();
    await doc.ref.update({ status: 'expired' });
    
    await createAuditLog(
      'account.automation_expired',
      'system',
      { before: { status: 'trial' }, after: { status: 'expired' } },
      { targetUid: account.uid, reason: 'Trial expired - automated status change' }
    );
  }
});
```

## Notas Importantes

1. **Solo cuando la base esté estable:** No implementar automatizaciones hasta que la base de datos y las reglas estén completamente probadas.

2. **Override manual siempre disponible:** Las automatizaciones nunca deben bloquear acciones manuales desde Owner Console.

3. **Auditoría completa:** Todas las automatizaciones deben registrar en `platform/audit` con `performedBy: 'system'`.

4. **Testing:** Probar exhaustivamente en staging antes de producción.

5. **Frecuencia:** Ejecutar diariamente o según necesidad (no más frecuente que cada hora).
