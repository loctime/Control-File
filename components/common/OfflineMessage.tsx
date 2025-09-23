'use client';

// components/common/OfflineMessage.tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OfflineMessageProps {
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function OfflineMessage({ 
  message = "Sin conexión a internet. Algunas funciones no están disponibles.", 
  onRetry,
  showRetry = true 
}: OfflineMessageProps) {
  return (
    <Alert className="border-orange-200 bg-orange-50">
      <WifiOff className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <div className="flex items-center justify-between">
          <span>{message}</span>
          {showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
