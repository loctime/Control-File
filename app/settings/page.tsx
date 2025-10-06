'use client';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/common/ThemeProvider';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  HardDrive, 
  User, 
  Settings, 
  Moon, 
  Sun, 
  Monitor,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { getPlansCatalog, getRecommendedUpsells, formatPrice, getPlanPrice } from '@/lib/plans';

export default function SettingsPage() {
  const { user, logOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  if (!user) {
    router.push('/auth');
    return null;
  }

  const usedBytes = user.usedBytes + user.pendingBytes;
  const totalBytes = user.planQuotaBytes;
  const percentage = (usedBytes / totalBytes) * 100;
  const catalog = getPlansCatalog();
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(catalog.billingInterval);
  useEffect(() => {
    (async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const token = await auth?.currentUser?.getIdToken();
        if (token) {
          const res = await fetch('/api/user/settings', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.billingInterval === 'monthly' || data?.billingInterval === 'yearly') {
              setInterval(data.billingInterval);
            } else {
              const saved = typeof window !== 'undefined' ? localStorage.getItem('billingInterval') : null;
              if (saved === 'monthly' || saved === 'yearly') setInterval(saved);
            }
          }
        }
      } catch {}
    })();
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('billingInterval', interval);
    }
    (async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const token = await auth?.currentUser?.getIdToken();
        if (!token) return;
        await fetch('/api/user/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ billingInterval: interval }),
        });
      } catch {}
    })();
  }, [interval]);
  const upsells = getRecommendedUpsells(totalBytes);

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const handleLogOut = async () => {
    try {
      await logOut();
      router.push('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      const { auth } = await import('@/lib/firebase');
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error('No autenticado');
      const res = await fetch('/api/user/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ planId, interval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error actualizando plan');
      // Refrescar datos locales
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Configuración</h1>
              <p className="text-muted-foreground">Gestiona tu cuenta y preferencias</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl space-y-8">
          {/* User Info */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <User className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Información de la cuenta</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              
              {user.displayName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre:</span>
                  <span className="font-medium">{user.displayName}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Miembro desde:</span>
                <span className="font-medium">
                  {user.createdAt.toLocaleDateString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* Storage Quota */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <HardDrive className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Almacenamiento</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Espacio usado:</span>
                <span className={`font-medium ${getQuotaColor(percentage)}`}>
                  {formatFileSize(usedBytes)} de {formatFileSize(totalBytes)}
                </span>
              </div>
              
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    percentage >= 90 ? 'bg-red-500' :
                    percentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Archivos:</span>
                  <span>{formatFileSize(user.usedBytes)}</span>
                </div>
                
                {user.pendingBytes > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subiendo:</span>
                    <span>{formatFileSize(user.pendingBytes)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disponible:</span>
                  <span>{formatFileSize(totalBytes - usedBytes)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Porcentaje:</span>
                  <span>{Math.round(percentage)}%</span>
                </div>
              </div>
              
              {percentage > 90 && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Tu almacenamiento está casi lleno. Considera eliminar archivos o solicitar más espacio.
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Planes recomendados</div>
                <div className="inline-flex items-center gap-2 mb-2 text-sm">
                  <span>Facturación:</span>
                  <div className="inline-flex rounded-md border p-1">
                    <button className={`px-3 py-1 rounded ${interval === 'monthly' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setInterval('monthly')}>Mensual</button>
                    <button className={`px-3 py-1 rounded ${interval === 'yearly' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setInterval('yearly')}>Anual</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {upsells.map((plan) => {
                    const monthly = getPlanPrice(plan, 'monthly');
                    const yearly = getPlanPrice(plan, 'yearly');
                    const yearlyAsMonthly = yearly / 12;
                    const savingsPct = Math.max(0, Math.round((1 - (yearly / (monthly * 12))) * 100));
                    const showSavings = interval === 'yearly' && savingsPct > 0;
                    return (
                      <div key={plan.planId} className="relative border rounded-lg p-3 hover:bg-accent transition-colors" title={`${plan.name} • ${formatPrice(getPlanPrice(plan, interval), catalog.currency)} / ${interval}`}>
                        {showSavings && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded">Ahorra {savingsPct}%</div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{plan.name}</div>
                          <div className="text-sm text-muted-foreground" title={`Mensual: ${formatPrice(monthly, catalog.currency)} | Anual: ${formatPrice(yearly, catalog.currency)} (${formatPrice(yearlyAsMonthly, catalog.currency)}/mes)`}>
                            {formatPrice(getPlanPrice(plan, interval), catalog.currency)}/{interval === 'monthly' ? 'mes' : 'año'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button variant="outline" onClick={() => handleUpgrade(plan.planId)}>
                            Mejorar plan
                          </Button>
                          <Button variant="default" onClick={async () => {
                            try {
                              const { auth } = await import('@/lib/firebase');
                              const token = await auth?.currentUser?.getIdToken();
                              if (!token) throw new Error('No autenticado');
                              const res = await fetch('/api/billing/checkout', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                },
                                body: JSON.stringify({ planId: plan.planId, interval }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Error iniciando checkout');
                              if (typeof window !== 'undefined') {
                                window.location.href = data.url;
                              }
                            } catch (e) {
                              console.error(e);
                              alert((e as Error).message);
                            }
                          }}>
                            Pagar con Stripe
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <Settings className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Preferencias</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tema de la aplicación
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Claro
                  </Button>
                  
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Oscuro
                  </Button>
                  
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Sistema
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Acciones</h2>
            
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open('/shared', '_blank')}
              >
                Ver archivos compartidos
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open('/recent', '_blank')}
              >
                Archivos recientes
              </Button>
              
              <Separator />
              
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleLogOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
