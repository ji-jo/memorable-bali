import { useEffect, useState, type RefObject } from 'react';

export interface HorizontalScrollOverflow {
  /** Content wider than the visible rail. */
  overflows: boolean;
  /** Can scroll toward the start. */
  canScrollLeft: boolean;
  /** Can scroll toward the end. */
  canScrollRight: boolean;
}

const DRAG_THRESHOLD_PX = 6;

/**
 * Tracks whether a horizontal scroller overflows and which edges still have
 * more content. Fade / chevrons should only show when `overflows` is true.
 *
 * Also enables pointer drag-to-scroll for mouse/pen (touch keeps native
 * overflow momentum). A drag past the threshold suppresses the following click
 * so links and chips inside the rail do not activate mid-swipe.
 */
export function useHorizontalScrollOverflow(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
): HorizontalScrollOverflow {
  const [state, setState] = useState<HorizontalScrollOverflow>({
    overflows: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const overflows = scrollWidth > clientWidth + 1;
      setState({
        overflows,
        canScrollLeft: overflows && scrollLeft > 2,
        canScrollRight: overflows && scrollLeft + clientWidth < scrollWidth - 2,
      });
    };

    update();
    const raf = requestAnimationFrame(update);

    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    for (const child of el.children) {
      resizeObserver.observe(child);
    }

    const mutationObserver = new MutationObserver(() => {
      for (const child of el.children) {
        resizeObserver.observe(child);
      }
      update();
    });
    mutationObserver.observe(el, { childList: true });

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls invalidation via deps
  }, deps);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startScrollLeft = 0;
    let dragging = false;

    const clearDragging = () => {
      pointerId = null;
      dragging = false;
      el.dataset.dragging = 'false';
    };

    const suppressNextClick = () => {
      const blockClick = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        el.removeEventListener('click', blockClick, true);
      };
      el.addEventListener('click', blockClick, true);
      window.setTimeout(() => {
        el.removeEventListener('click', blockClick, true);
      }, 0);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // Touch keeps native overflow scrolling (momentum + rubber-banding).
      if (event.pointerType === 'touch') return;
      if ((event.target as HTMLElement | null)?.closest('[data-no-drag-scroll]')) {
        return;
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = el.scrollLeft;
      dragging = false;
      // Do not capture yet — capturing on every press steals click from chips/links.
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        el.dataset.dragging = 'true';
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // ignore — capture can fail if the pointer already ended
        }
      }
      el.scrollLeft = startScrollLeft - dx;
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const didDrag = dragging;
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      clearDragging();
      if (didDrag) suppressNextClick();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      clearDragging();
    };

    const onDragStart = (event: DragEvent) => {
      // Links/images inside the rail must not start a native HTML drag.
      event.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('dragstart', onDragStart);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('dragstart', onDragStart);
      delete el.dataset.dragging;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls invalidation via deps
  }, deps);

  return state;
}
