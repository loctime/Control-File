// components/user/GoogleSyncButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGoogleSync } from '@/hooks/useGoogleSync';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';

export function GoogleSyncButton() {
  const { forceGoogleSync, hasGoogleChanges } = useGoogleSync();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const success = await forceGoogleSync();
      if (success) {
        setLastSync(new Date());
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        variant={hasGoogleChanges ? "default" : "outline"}
        size="sm"
        className="flex items-center gap-2"
      >
        {isSyncing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : hasGoogleChanges ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {isSyncing 
          ? 'Sincronizando...' 
          : hasGoogleChanges 
            ? 'Sincronizar con Google' 
            : 'Sincronizado'
        }
      </Button>
      
      {lastSync && (
        <span className="text-xs text-muted-foreground">
          Última sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
