import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import styles from './Sheet.module.css';

export type SnapPoint = 'peek' | 'half' | 'full';

export interface SheetProps {
  /** Vertical offset per snap point, as a % of sheet height translated down. */
  snap: SnapPoint;
  onSnapChange: (next: SnapPoint) => void;
  /**
   * Fraction of the viewport currently covered by the visible sheet (0–1).
   * Updates while dragging so the map can keep Bali in the visible center.
   */
  onCoverChange?: (cover: number) => void;
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

function coverFromOffset(sheetHeight: number, offsetPct: number, viewportHeight: number): number {
  if (viewportHeight <= 0 || sheetHeight <= 0) return 0;
  return Math.min(0.92, Math.max(0, (sheetHeight * (1 - offsetPct / 100)) / viewportHeight));
}

/**
 * Bottom sheet with three snap points, used as Explore's list container.
 * The map remains visible behind it — this is not a modal and it never
 * traps focus or blocks the page.
 */
export function Sheet({
  snap,
  onSnapChange,
  onCoverChange,
  title,
  header,
  children,
}: SheetProps) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragState = useRef<{ startY: number; startOffset: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCoverChangeRef = useRef(onCoverChange);

  useEffect(() => {
    onCoverChangeRef.current = onCoverChange;
  }, [onCoverChange]);

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

  // Keep the map's visible band in sync with the sheet (including live drag).
  useEffect(() => {
    const sheet = sheetRef.current;
    const report = onCoverChangeRef.current;
    if (!sheet || !report) return;

    const publish = () => {
      report(coverFromOffset(sheet.offsetHeight, offset, window.innerHeight));
    };

    publish();
    window.addEventListener('resize', publish);
    return () => window.removeEventListener('resize', publish);
  }, [offset]);

  const snapIndex = ORDER.indexOf(snap);

  const onHandleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      onSnapChange(ORDER[Math.min(ORDER.length - 1, snapIndex + 1)] ?? 'full');
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      onSnapChange(ORDER[Math.max(0, snapIndex - 1)] ?? 'peek');
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onSnapChange('full');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      onSnapChange('peek');
    }
  };

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${dragOffset !== null ? styles.dragging : ''}`}
      style={{ ['--sheet-offset']: `${offset}%` } as CSSProperties}
    >
      <div
        className={styles.handleArea}
        onPointerDown={startDrag}
        onKeyDown={onHandleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="Resize list sheet"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={ORDER.length - 1}
        aria-valuenow={snapIndex}
        aria-valuetext={
          snap === 'peek' ? 'Map view' : snap === 'half' ? 'Split view' : 'List view'
        }
      >
        <div className={styles.handle} aria-hidden="true" />
      </div>

      {(header || title) && (
        <div className={styles.header}>
          <div className={styles.headerMain}>
            {header ?? (title ? <span className={styles.title}>{title}</span> : null)}
          </div>
        </div>
      )}

      <div className={styles.content}>{children}</div>
    </div>
  );
}
