import { animate } from 'motion/react';

import { SPRING_PIN, SPRING_PIN_EXIT } from '@/lib/ease';

const HOVER_CLASS = 'bali-pin--hover';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function previewTargets(pin: HTMLElement) {
  const preview = pin.querySelector<HTMLElement>('.bali-pin__preview');
  const dot = pin.querySelector<HTMLElement>('.bali-pin__dot');
  return { preview, dot };
}

function setPreviewVisible(
  pin: HTMLElement,
  visible: boolean,
  options?: { instant?: boolean },
) {
  const { preview, dot } = previewTargets(pin);
  const instant = options?.instant || prefersReducedMotion();

  pin.classList.toggle(HOVER_CLASS, visible);

  if (preview) {
    const visibleState = { opacity: 1, x: '-50%', y: 0, scale: 1 };
    const hiddenState = { opacity: 0, x: '-50%', y: 8, scale: 0.96 };

    if (instant) {
      preview.style.opacity = visible ? '1' : '0';
      preview.style.transform = visible
        ? 'translate(-50%, 0) scale(1)'
        : 'translate(-50%, 8px) scale(0.96)';
    } else {
      void animate(preview, visible ? visibleState : hiddenState, visible ? SPRING_PIN : SPRING_PIN_EXIT);
    }
  }

  if (dot) {
    if (instant) {
      dot.style.transform = visible ? 'scale(1.35)' : 'scale(1)';
    } else {
      void animate(dot, { scale: visible ? 1.35 : 1 }, SPRING_PIN);
    }
  }
}

function shouldStayOpen(pin: HTMLElement) {
  return pin.classList.contains('bali-pin--selected') || pin.classList.contains(HOVER_CLASS);
}

export function syncSelectedPinPreviews(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('.bali-pin').forEach((pin) => {
    const open = pin.classList.contains('bali-pin--selected');
    setPreviewVisible(pin, open, { instant: true });
  });
}

/** Spring hover previews for HTML map pins rendered by Navigatr. */
export function bindMapPinMotion(container: HTMLElement): () => void {
  let activePin: HTMLElement | null = null;

  const activate = (pin: HTMLElement | null) => {
    if (!pin || activePin === pin) return;
    if (activePin && activePin !== pin && !activePin.classList.contains('bali-pin--selected')) {
      setPreviewVisible(activePin, false);
    }
    activePin = pin;
    setPreviewVisible(pin, true);
  };

  const deactivate = (pin: HTMLElement) => {
    if (pin.classList.contains('bali-pin--selected')) return;
    setPreviewVisible(pin, false);
    if (activePin === pin) activePin = null;
  };

  const onPointerOver = (event: PointerEvent) => {
    const pin = (event.target as HTMLElement).closest<HTMLElement>('.bali-pin');
    if (pin && container.contains(pin)) activate(pin);
  };

  const onPointerOut = (event: PointerEvent) => {
    const pin = (event.target as HTMLElement).closest<HTMLElement>('.bali-pin');
    if (!pin || !container.contains(pin)) return;
    const related = event.relatedTarget as Node | null;
    if (related && pin.contains(related)) return;
    deactivate(pin);
  };

  const onFocusIn = (event: FocusEvent) => {
    const pin = (event.target as HTMLElement).closest<HTMLElement>('.bali-pin');
    if (pin && container.contains(pin)) activate(pin);
  };

  const onFocusOut = (event: FocusEvent) => {
    const pin = (event.target as HTMLElement).closest<HTMLElement>('.bali-pin');
    if (!pin || !container.contains(pin)) return;
    const related = event.relatedTarget as Node | null;
    if (related && pin.contains(related)) return;
    deactivate(pin);
  };

  container.addEventListener('pointerover', onPointerOver);
  container.addEventListener('pointerout', onPointerOut);
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);

  return () => {
    container.removeEventListener('pointerover', onPointerOver);
    container.removeEventListener('pointerout', onPointerOut);
    container.removeEventListener('focusin', onFocusIn);
    container.removeEventListener('focusout', onFocusOut);
    if (activePin && !shouldStayOpen(activePin)) setPreviewVisible(activePin, false);
    activePin = null;
  };
}
