import { useEffect, useState, type RefObject } from 'react';

export type GlassTone = 'light' | 'dark';

type Rgba = { r: number; g: number; b: number; a: number };
type SamplePoint = { x: number; y: number };

function parseColor(value: string): Rgba | null {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) return null;
  const [r, g, b, a = 1] = channels;
  if (r === undefined || g === undefined || b === undefined) return null;
  return { r, g, b, a };
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r:
      (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) /
      alpha,
    g:
      (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) /
      alpha,
    b:
      (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) /
      alpha,
    a: alpha,
  };
}

function relativeLuminance({ r, g, b }: Rgba) {
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function luminanceAtPoint(x: number, y: number, root: HTMLElement) {
  const layers = document.elementsFromPoint(x, y).filter((element) => !root.contains(element));
  let color: Rgba = { r: 255, g: 255, b: 255, a: 1 };

  for (const element of layers.reverse()) {
    const layerColor = parseColor(getComputedStyle(element).backgroundColor);
    if (layerColor && layerColor.a > 0) color = composite(layerColor, color);
  }

  return relativeLuminance(color);
}

function detectGlassTone(root: HTMLElement, samplePoints: SamplePoint[]): GlassTone {
  const luminances = samplePoints.map(({ x, y }) =>
    luminanceAtPoint(
      Math.max(0, Math.min(window.innerWidth - 1, x)),
      Math.max(0, Math.min(window.innerHeight - 1, y)),
      root,
    ),
  );
  const average = luminances.reduce((total, value) => total + value, 0) / luminances.length;
  return average >= 0.45 ? 'light' : 'dark';
}

/** Sample the backdrop behind a glass surface and pick light/dark text + tint. */
export function useGlassTone(
  rootRef: RefObject<HTMLElement | null>,
  getSamplePoints?: (rect: DOMRect) => SamplePoint[],
) {
  const [tone, setTone] = useState<GlassTone>('light');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const samplePoints = getSamplePoints?.(rect) ?? [
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        ];
        const next = detectGlassTone(root, samplePoints);
        setTone((current) => (current === next ? current : next));
      });
    };

    const observer = new ResizeObserver(update);
    const root = rootRef.current;
    if (root) observer.observe(root);

    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    document.addEventListener('pointerup', update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerup', update);
    };
  }, [getSamplePoints, rootRef]);

  return tone;
}
