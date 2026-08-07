import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import styles from './Sheet.module.css';

export type SnapPoint = 'peek' | 'half' | 'full';

export interface SheetProps {
  /** Vertical offset per snap point, as a % of sheet height translated down. */
  snap: SnapPoint;
  onSnapChange: (next: SnapPoint) => void;
  title?: string;
  /** Custom header content — replaces `title` when provided. */
  header?: ReactNode;
  children: ReactNode;
}

/** How far the sheet is pushed down at each snap point. */
const OFFSET: Record<SnapPoint, number> = {
  peek: 78,
  half: 45,
  full: 4,
};

const ORDER: SnapPoint[] = ['peek', 'half', 'full'];

/**
 * Bottom sheet with three snap points, used as Explore's list container below
 * 1024px. The map remains visible behind it — this is not a modal and it never
 * traps focus or blocks the page.
 */
export function Sheet({ snap, onSnapChange, title, header, children }: SheetProps) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragState = useRef<{ startY: number; startOffset: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const endDrag = useCallback(
    (finalOffset: number) => {
      // Snap to whichever point is closest to where the drag ended.
      const closest = ORDER.reduce((best, point) =>
        Math.abs(OFFSET[point] - finalOffset) < Math.abs(OFFSET[best] - finalOffset)
          ? point
          : best,
      );
      dragState.current = null;
      setDragOffset(null);
      onSnapChange(closest);
    },
    [onSnapChange],
  );

  useEffect(() => {
    if (dragOffset === null) return;

    const onMove = (e: PointerEvent) => {
      const state = dragState.current;
      const height = sheetRef.current?.offsetHeight ?? window.innerHeight;
      if (!state) return;
      const deltaPct = ((e.clientY - state.startY) / height) * 100;
      setDragOffset(Math.min(95, Math.max(0, state.startOffset + deltaPct)));
    };

    const onUp = () => {
      setDragOffset((current) => {
        if (current !== null) endDrag(current);
        return current;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragOffset, endDrag]);

  const startDrag = (e: React.PointerEvent) => {
    dragState.current = { startY: e.clientY, startOffset: OFFSET[snap] };
    setDragOffset(OFFSET[snap]);
  };

  const offset = dragOffset ?? OFFSET[snap];
  const isExpanded = snap === 'full';

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${dragOffset !== null ? styles.dragging : ''}`}
      style={{ ['--sheet-offset']: `${offset}%` } as CSSProperties}
    >
      <div className={styles.handleArea} onPointerDown={startDrag}>
        <div className={styles.handle} aria-hidden="true" />
      </div>

      <div className={`${styles.header} ${!header && !title ? styles.headerSnapOnly : ''}`}>
        {(header || title) && (
          <div className={styles.headerMain}>
            {header ?? (title ? <span className={styles.title}>{title}</span> : null)}
          </div>
        )}
        {/* Required: drag gestures are not keyboard- or screen-reader-reachable. */}
        <button
          type="button"
          className={styles.snapButton}
          onClick={() => onSnapChange(isExpanded ? 'peek' : 'full')}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show map' : 'Show list'}
        </button>
      </div>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
