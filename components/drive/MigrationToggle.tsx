// components/drive/MigrationToggle.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileExplorer } from './FileExplorer';
import { HybridFileExplorer } from './HybridFileExplorer';
import { useFilesCompatible } from '@/hooks/useFilesCompatible';

interface MigrationToggleProps {
  folderId?: string | null;
}

export function MigrationToggle({ folderId = null }: MigrationToggleProps) {
  const [useOptimized, setUseOptimized] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Cargar preferencia del localStorage
  useEffect(() => {
    const saved = localStorage.getItem('use-optimized-explorer');
    if (saved) {
      setUseOptimized(JSON.parse(saved));
    }
  }, []);

  // Guardar preferencia
  const handleToggle = (checked: boolean) => {
    setUseOptimized(checked);
    localStorage.setItem('use-optimized-explorer', JSON.stringify(checked));
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Barra de control */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="optimized-mode"
                checked={useOptimized}
                onCheckedChange={handleToggle}
              />
              <Label htmlFor="optimized-mode">
                Modo Optimizado (TanStack)
              </Label>
            </div>
            
            <Badge variant={useOptimized ? 'default' : 'secondary'}>
              {useOptimized ? 'TanStack Query' : 'Zustand + Fetch'}
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
            >
              {showComparison ? 'Ocultar' : 'Mostrar'} Comparación
            </Button>
          </div>
        </div>

        {showComparison && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Comparación de Rendimiento</CardTitle>
              <CardDescription className="text-xs">
                TanStack Query vs Zustand + Fetch manual
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-green-600">TanStack Query</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>✅ Cache inteligente</li>
                    <li>✅ Optimistic updates</li>
                    <li>✅ Error handling robusto</li>
                    <li>✅ Background refetch</li>
                    <li>✅ DevTools integrado</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-orange-600">Zustand + Fetch</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>⚠️ Cache manual</li>
                    <li>⚠️ Loading states básicos</li>
                    <li>⚠️ Error handling limitado</li>
                    <li>⚠️ Requests duplicados</li>
                    <li>⚠️ Sin DevTools</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {useOptimized ? (
          <HybridFileExplorer folderId={folderId} />
        ) : (
          <FileExplorer />
        )}
      </div>
    </div>
  );
}
