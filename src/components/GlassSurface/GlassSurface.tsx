import { useRef, type ReactNode } from 'react';
import { LiquidGlass } from '@liquidglass/react';

import { useGlassTone } from '@/hooks/use-glass-tone';
import { cn } from '@/lib/utils';

export interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  borderRadius?: number;
}

/**
 * Frosted glass shell — same LiquidGlass treatment as ExpandableTabs.
 */
export function GlassSurface({ children, className, borderRadius = 22 }: GlassSurfaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glassTone = useGlassTone(rootRef);

  return (
    <div
      ref={rootRef}
      data-glass-tone={glassTone}
      className={cn('relative overflow-hidden bg-transparent', className)}
      style={{ borderRadius }}
    >
      <LiquidGlass
        borderRadius={borderRadius}
        blur={0.5}
        contrast={1.2}
        brightness={1.1}
        saturation={1.2}
        shadowIntensity={0}
        displacementScale={1}
        elasticity={0.6}
        zIndex={1}
        className={cn(
          'h-full w-full text-current transition-colors duration-200',
          glassTone === 'light' ? 'bg-white/80 text-neutral-950' : 'bg-black/65 text-white',
        )}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}
