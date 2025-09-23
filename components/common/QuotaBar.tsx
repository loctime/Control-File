'use client';

import { useAuthStore } from '@/lib/stores/auth';
import { formatFileSize } from '@/lib/utils';

export function QuotaBar() {
  const { user } = useAuthStore();

  if (!user) return null;

  const usedBytes = user.usedBytes + user.pendingBytes;
  const totalBytes = user.planQuotaBytes;
  const percentage = (usedBytes / totalBytes) * 100;

  const getColorClass = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getColorClass(percentage)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className="min-w-[60px]">
          {formatFileSize(usedBytes)} / {formatFileSize(totalBytes)}
        </span>
      </div>
    </div>
  );
}