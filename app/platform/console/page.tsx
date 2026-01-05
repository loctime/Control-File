'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PlatformAccount } from '@/lib/platform/accounts';
import type { PlatformPlan } from '@/lib/platform/plans';
import type { PlatformPayment } from '@/lib/platform/payments';
import { resolveAccountStates, type ResolvedAccountState } from '@/lib/platform/resolveAccount';
import { checkPlatformOwnerAccess } from '@/lib/platform/verifyOwner';

export default function PlatformConsolePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [resolvedAccounts, setResolvedAccounts] = useState<ResolvedAccountState[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Validar permisos platform_owner ANTES de cargar datos
    validateAndLoad();
  }, [user]);

  const validateAndLoad = async () => {
    // Validar custom claim platform_owner (obligatorio)
    const accessCheck = await checkPlatformOwnerAccess();
    
    if (!accessCheck.hasAccess) {
      setAuthorized(false);
      setError(accessCheck.error || 'Acceso denegado');
      setLoading(false);
      return;
    }

    setAuthorized(true);
    await loadData();
  };

  const loadData = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setError('No autorizado');
        setLoading(false);
        return;
      }

      // Cargar cuentas, planes y pagos en paralelo
      const [accountsRes, plansRes, paymentsRes] = await Promise.all([
        fetch('/api/platform/accounts', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/platform/plans', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/platform/payments', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!accountsRes.ok || !plansRes.ok || !paymentsRes.ok) {
        const errorText = await accountsRes.text().catch(() => 'Error desconocido');
        setError(`Error cargando datos: ${errorText}`);
        setLoading(false);
        return;
      }

      const accountsData = await accountsRes.json();
      const plansData = await plansRes.json();
      const paymentsData = await paymentsRes.json();

      const accounts: PlatformAccount[] = accountsData.accounts || [];
      const plansList: PlatformPlan[] = plansData.plans || [];
      const paymentsList: PlatformPayment[] = paymentsData.payments || [];

      // Crear mapa de planes para resolución eficiente
      const plansMap = new Map<string, PlatformPlan>();
      plansList.forEach(plan => plansMap.set(plan.planId, plan));

      // Resolver estados de cuentas usando capa de dominio
      const resolved = resolveAccountStates(accounts, plansMap);

      setResolvedAccounts(resolved);
      setPlans(plansList);
      setPayments(paymentsList);
      setLoading(false);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error cargando datos');
      setLoading(false);
    }
  };

  // Bloquear render si no está autorizado
  if (authorized === false) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Acceso Denegado</CardTitle>
            <CardDescription>{error || 'Se requieren permisos de platform_owner'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading || authorized === null) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  if (error && authorized) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Platform Console</h1>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts">Cuentas</TabsTrigger>
          <TabsTrigger value="plans">Planes</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Cuentas</CardTitle>
              <CardDescription>Gestión de cuentas de usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {resolvedAccounts.length === 0 ? (
                  <p>No hay cuentas</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">UID</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Plan</th>
                        <th className="text-left p-2">Apps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedAccounts.map((resolved) => {
                        const { account, planDisplayName, enabledAppsList, canRead, canWrite } = resolved;
                        return (
                          <tr key={account.uid} className="border-b">
                            <td className="p-2">{account.uid}</td>
                            <td className="p-2">
                              <span className={account.status === 'suspended' ? 'text-red-500' : ''}>
                                {account.status}
                              </span>
                              {!canRead && <span className="ml-2 text-xs text-gray-500">(sin lectura)</span>}
                              {!canWrite && <span className="ml-2 text-xs text-gray-500">(sin escritura)</span>}
                            </td>
                            <td className="p-2">{planDisplayName}</td>
                            <td className="p-2">
                              {enabledAppsList.length > 0 ? enabledAppsList.join(', ') : 'Ninguna'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Planes</CardTitle>
              <CardDescription>Gestión de planes disponibles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {plans.length === 0 ? (
                  <p>No hay planes</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Plan ID</th>
                        <th className="text-left p-2">Nombre</th>
                        <th className="text-left p-2">Activo</th>
                        <th className="text-left p-2">Precio Mensual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.planId} className="border-b">
                          <td className="p-2">{plan.planId}</td>
                          <td className="p-2">{plan.name}</td>
                          <td className="p-2">{plan.isActive ? 'Sí' : 'No'}</td>
                          <td className="p-2">${plan.pricing.monthly}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Pagos</CardTitle>
              <CardDescription>Historial de pagos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.length === 0 ? (
                  <p>No hay pagos</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Payment ID</th>
                        <th className="text-left p-2">UID</th>
                        <th className="text-left p-2">Monto</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.paymentId} className="border-b">
                          <td className="p-2">{payment.paymentId}</td>
                          <td className="p-2">{payment.uid}</td>
                          <td className="p-2">${payment.amount} {payment.currency}</td>
                          <td className="p-2">{payment.status}</td>
                          <td className="p-2">
                            {payment.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
