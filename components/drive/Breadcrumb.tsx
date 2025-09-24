'use client';

import { ChevronRight, Home } from 'lucide-react';
import { useDriveStore } from '@/lib/stores/drive';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/hooks/useNavigation';

export function Breadcrumb() {
  const { breadcrumb } = useDriveStore();
  const { navigateToFolder } = useNavigation();

  const handleBreadcrumbClick = (index: number) => {
    const targetBreadcrumb = breadcrumb[index];
    // Navegar a la carpeta específica usando el nuevo sistema
    navigateToFolder(targetBreadcrumb.id);
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      {breadcrumb.map((item, index) => (
        <div key={item.id} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-sm ${
              index === breadcrumb.length - 1 
                ? 'text-foreground font-medium' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleBreadcrumbClick(index)}
            disabled={index === breadcrumb.length - 1}
          >
            {index === 0 ? (
              <Home className="h-3 w-3 mr-1" />
            ) : null}
            {item.name}
          </Button>
        </div>
      ))}
    </div>
  );
}