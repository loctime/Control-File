'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImpactAnimationProps {
  type: 'success' | 'error';
  onComplete?: () => void;
  className?: string;
}

export function ImpactAnimation({ type, onComplete, className }: ImpactAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showRipple, setShowRipple] = useState(false);

  useEffect(() => {
    // Iniciar animación
    setIsVisible(true);
    
    // Mostrar ripple después de un pequeño delay
    const rippleTimer = setTimeout(() => setShowRipple(true), 100);
    
    // Completar animación
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 2000);

    return () => {
      clearTimeout(rippleTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const isSuccess = type === 'success';
  const Icon = isSuccess ? Check : X;
  const colorClasses = isSuccess 
    ? 'text-green-500 bg-green-500/10' 
    : 'text-red-500 bg-red-500/10';

  return (
    <div className={cn('relative', className)}>
      {/* Punto principal que golpea */}
      <div
        className={cn(
          'relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300',
          colorClasses,
          isVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        )}
        style={{
          animation: isVisible ? 'impactBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'none'
        }}
      >
        <Icon className="w-8 h-8" />
        
        {/* Efecto de ondas concéntricas */}
        {showRipple && (
          <>
            {[1, 2, 3].map((ring) => (
              <div
                key={ring}
                className={cn(
                  'absolute inset-0 rounded-full border-2 animate-ping',
                  isSuccess ? 'border-green-500' : 'border-red-500'
                )}
                style={{
                  animationDelay: `${ring * 0.2}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Partículas que se dispersan */}
      {showRipple && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'absolute w-2 h-2 rounded-full animate-ping',
                isSuccess ? 'bg-green-500' : 'bg-red-500'
              )}
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-40px)`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes impactBounce {
          0% {
            transform: scale(0) translateY(-20px);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) translateY(0);
            opacity: 1;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
