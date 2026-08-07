import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

import styles from './SunRayShader.module.css';

// =============================================================================
// Color utilities
// =============================================================================

function parseHex(hex: string): [number, number, number] {
  let h = (hex || '#000000').replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = parseInt(h.slice(0, 6) || '000000', 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

let colorCtx: CanvasRenderingContext2D | null = null;

function colorRGB(str: string): [number, number, number] {
  if (typeof document === 'undefined') {
    const [r, g, b] = parseHex(str);
    return [r / 255, g / 255, b / 255];
  }
  if (!colorCtx) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    colorCtx = c.getContext('2d', { willReadFrequently: true });
  }
  if (!colorCtx) return [0, 0, 0];
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = str || '#000000';
  colorCtx.fillRect(0, 0, 1, 1);
  const d = colorCtx.getImageData(0, 0, 1, 1).data;
  return [(d[0] ?? 0) / 255, (d[1] ?? 0) / 255, (d[2] ?? 0) / 255];
}

// =============================================================================
// WebGL shaders
// =============================================================================

const VERT_SRC = `
  attribute vec2 p;
  void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG_SRC = `
  precision highp float;

  uniform vec2  uRes;
  uniform vec2  uContainerRes;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRotation;
  uniform float uScale;
  uniform float uOffsetX;
  uniform float uOffsetY;
  uniform float uCoreSize;
  uniform float uRayLength;
  uniform float uRayThickness;
  uniform float uFluffiness;
  uniform float uFlareAngle;
  uniform float uFlareDistance;
  uniform float uFlareRoundSize;
  uniform float uFlareStrength;
  uniform vec3  uCore;
  uniform vec3  uMid;
  uniform vec3  uEdge;
  uniform vec3  uFlareNear;
  uniform vec3  uFlareFar;

  float sdHex(vec2 p, float r) {
    const vec2 k1 = vec2(-0.866025, 0.5);
    const float k2 = 0.577350;
    p = abs(p);
    p -= 2.0 * min(dot(k1, p), 0.0) * k1;
    p -= vec2(clamp(p.x, -k2 * r, k2 * r), r);
    return length(p) * sign(p.y);
  }

  float ghost(vec2 p, float r, float softness, float rot) {
    float cr = cos(rot), sr = sin(rot);
    vec2 pr = vec2(p.x*cr - p.y*sr, p.x*sr + p.y*cr);
    float d    = sdHex(pr, r);
    float t    = clamp(-d / max(r, 0.0001), 0.0, 1.0);
    float soft = r * mix(0.05, 0.52, softness);
    float mask = 1.0 - smoothstep(-soft * 0.3, soft, d);
    float limb = exp(-t * t * mix(3.2, 0.75, softness)) * mix(0.78, 0.36, softness);
    float fill = mix(0.08, 0.20, softness) * (1.0 - t * 0.5);
    float halo = exp(-max(0.0, d) / (r * mix(0.40, 1.80, softness))) * mix(0.05, 0.16, softness);
    return mask * (limb + fill) + halo;
  }

  void main() {
    vec2  centerPx = uRes * 0.5 + vec2(uOffsetX, uContainerRes.y * 0.5 - uOffsetY);
    float maxDim   = max(uContainerRes.x, uContainerRes.y);
    vec2  pRaw     = (gl_FragCoord.xy - centerPx) / maxDim;

    float sinR = sin(uRotation), cosR = cos(uRotation);
    vec2  pS   = vec2(pRaw.x * cosR - pRaw.y * sinR,
                      pRaw.x * sinR + pRaw.y * cosR);
    vec2  p    = pS / max(0.0001, uScale);
    float r    = length(p);
    float a    = atan(p.y, p.x);

    float sharpness = mix(24.0, 1.5, uRayThickness);
    float primary   = pow(max(0.0, cos(a * 12.0 + uTime * 0.55)), sharpness);
    float secondary = pow(max(0.0, cos(a * 19.0 - uTime * 0.32)), sharpness * 1.2) * 0.45;
    float shimmer   = pow(max(0.0, cos(a *  7.0 + uTime * 0.18)), sharpness * 0.7) * 0.28;
    float rayFade   = exp(-r / max(0.001, uRayLength * 0.45));
    float rays      = (primary + secondary + shimmer) * rayFade;
    float core      = exp(-r * r * mix(90.0, 1.2, uCoreSize)) * 4.0;
    float fluff     = exp(-r * r * mix(12.0, 0.4, uFluffiness)) * uFluffiness * 2.0;
    float sunV      = (core + rays * 1.3 + fluff) * uIntensity;
    float rCol      = clamp(r * 1.3, 0.0, 1.0);
    vec3  sunCol    = rCol < 0.5
        ? mix(uCore, uMid,  rCol * 2.0)
        : mix(uMid,  uEdge, (rCol - 0.5) * 2.0);

    vec2  fDir  = vec2(cos(uFlareAngle), sin(uFlareAngle));
    float along = dot(pRaw, fDir);
    float perpL = length(pRaw - along * fDir);

    float streakAmp = 0.050 + sin(uTime * 3.2) * 0.018 + sin(uTime * 1.4) * 0.012;
    float streakW   = 2500.0 + sin(uTime * 2.1) * 180.0;
    float streak    = exp(-perpL * perpL * streakW)
                    / (abs(along) * 8.0 + 0.038) * streakAmp;

    float base = mix(0.015, 0.095, uFlareRoundSize);
    float gD   = uFlareDistance;

    float p0 = gD * 0.10 + sin(uTime * 0.62 + 0.00) * gD * 0.016;
    float p1 = gD * 0.20 + sin(uTime * 0.48 + 1.70) * gD * 0.020;
    float p2 = gD * 0.30 + sin(uTime * 0.71 + 3.40) * gD * 0.015;
    float p3 = gD * 0.44 + sin(uTime * 0.55 + 0.85) * gD * 0.022;
    float p4 = gD * 0.55 + sin(uTime * 0.40 + 2.60) * gD * 0.018;
    float p5 = gD * 0.70 + sin(uTime * 0.58 + 4.20) * gD * 0.024;
    float p6 = gD * 0.88 + sin(uTime * 0.35 + 1.30) * gD * 0.028;

    float s0 = base * 0.30; float b0 = 0.08;
    float s1 = base * 0.50; float b1 = 0.18;
    float s2 = base * 0.34; float b2 = 0.12;
    float s3 = base * 0.64; float b3 = 0.35;
    float s4 = base * 0.46; float b4 = 0.28;
    float s5 = base * 0.80; float b5 = 0.55;
    float s6 = base * 1.00; float b6 = 0.78;

    vec2 c0 = pRaw - fDir * p0;
    vec2 c1 = pRaw - fDir * p1;
    vec2 c2 = pRaw - fDir * p2;
    vec2 c3 = pRaw - fDir * p3;
    vec2 c4 = pRaw - fDir * p4;
    vec2 c5 = pRaw - fDir * p5;
    vec2 c6 = pRaw - fDir * p6;

    float r0 = uTime * 0.30 + 0.00;
    float r1 = uTime * 0.22 + 1.05;
    float r2 = uTime * 0.38 + 2.10;
    float r3 = uTime * 0.18 + 3.14;
    float r4 = uTime * 0.28 + 4.20;
    float r5 = uTime * 0.15 + 5.25;
    float r6 = uTime * 0.20 + 0.52;

    float t0 = 1.0 + sin(uTime * 1.30 + 0.00) * 0.14;
    float t1 = 1.0 + sin(uTime * 0.90 + 1.40) * 0.16;
    float t2 = 1.0 + sin(uTime * 1.60 + 2.80) * 0.13;
    float t3 = 1.0 + sin(uTime * 0.75 + 0.90) * 0.18;
    float t4 = 1.0 + sin(uTime * 1.10 + 4.20) * 0.15;
    float t5 = 1.0 + sin(uTime * 0.95 + 3.10) * 0.20;
    float t6 = 1.0 + sin(uTime * 1.20 + 5.50) * 0.22;

    vec3 col0 = uFlareNear;
    vec3 col1 = mix(uFlareNear, uFlareFar, 0.14);
    vec3 col2 = mix(uFlareNear, uFlareFar, 0.28);
    vec3 col3 = mix(uFlareNear, uFlareFar, 0.43);
    vec3 col4 = mix(uFlareNear, uFlareFar, 0.57);
    vec3 col5 = mix(uFlareNear, uFlareFar, 0.72);
    vec3 col6 = uFlareFar;

    vec3 gi6 = vec3(
        ghost(c6, s6 * 1.025, b6, r6),
        ghost(c6, s6 * 1.000, b6, r6),
        ghost(c6, s6 * 0.975, b6, r6)
    ) * t6;

    vec3 ghostAccum =
          ghost(c0, s0, b0, r0) * t0 * col0 * 0.38
        + ghost(c1, s1, b1, r1) * t1 * col1 * 0.40
        + ghost(c2, s2, b2, r2) * t2 * col2 * 0.36
        + ghost(c3, s3, b3, r3) * t3 * col3 * 0.42
        + ghost(c4, s4, b4, r4) * t4 * col4 * 0.38
        + ghost(c5, s5, b5, r5) * t5 * col5 * 0.44
        + gi6                        * col6 * 0.46;

    vec3 flareAccum = (streak * uMid * 0.50 + ghostAccum) * uFlareStrength * 1.8;

    float sunAlpha  = clamp(sunV, 0.0, 1.0);
    vec3  sunPremul = sunCol * sunAlpha;
    vec3  finalRGB  = min(sunPremul + flareAccum, vec3(1.0));
    float finalA    = min(1.0, sunAlpha + dot(flareAccum, vec3(0.333)));
    gl_FragColor    = vec4(finalRGB, finalA);
  }
`;

// =============================================================================
// Types & defaults
// =============================================================================

export type SunBlendMode = 'normal' | 'screen' | 'overlay' | 'color-dodge';
export type SunRenderMode = 'webgl' | 'css';

export interface SunRayShaderProps {
  appearance?: {
    coreColor?: string;
    midColor?: string;
    edgeColor?: string;
    intensity?: number;
    blendMode?: SunBlendMode;
  };
  rays?: {
    coreSize?: number;
    rayLength?: number;
    rayThickness?: number;
    fluffiness?: number;
    speed?: number;
  };
  flare?: {
    enabled?: boolean;
    direction?: number;
    distance?: number;
    roundSize?: number;
    strength?: number;
    colorNear?: string;
    colorFar?: string;
  };
  sunTransform?: {
    scale?: number;
    rotation?: number;
    offsetX?: number;
    offsetY?: number;
  };
  /** Force CSS fallback. Default: webgl (css when reduced-motion). */
  renderMode?: SunRenderMode;
  className?: string;
  style?: CSSProperties;
}

interface ResolvedProps {
  appearance: {
    coreColor: string;
    midColor: string;
    edgeColor: string;
    intensity: number;
    blendMode: SunBlendMode;
  };
  rays: {
    coreSize: number;
    rayLength: number;
    rayThickness: number;
    fluffiness: number;
    speed: number;
  };
  flare: {
    enabled: boolean;
    direction: number;
    distance: number;
    roundSize: number;
    strength: number;
    colorNear: string;
    colorFar: string;
  };
  sunTransform: {
    scale: number;
    rotation: number;
    offsetX: number;
    offsetY: number;
  };
  renderMode: SunRenderMode;
}

const DEFAULTS: ResolvedProps = {
  appearance: {
    // Mostly soft light with a hint of yellow chrome in the midtones.
    coreColor: '#FFF8E8',
    midColor: '#FFD84A',
    edgeColor: '#F0C040',
    intensity: 0.58,
    blendMode: 'screen',
  },
  rays: {
    coreSize: 0.28,
    rayLength: 0.55,
    rayThickness: 0.85,
    fluffiness: 0,
    speed: 1,
  },
  flare: {
    enabled: true,
    direction: -45,
    distance: 0.85,
    roundSize: 0.35,
    strength: 0.2,
    colorNear: '#FFE9A0',
    colorFar: '#FFD24A',
  },
  sunTransform: {
    scale: 0.72,
    rotation: 0,
    offsetX: 0,
    // Lowered 40px from -140 so the core sits under the header.
    offsetY: -100,
  },
  renderMode: 'webgl',
};

function resolveProps(props: SunRayShaderProps, reduceMotion: boolean): ResolvedProps {
  return {
    appearance: { ...DEFAULTS.appearance, ...props.appearance },
    rays: { ...DEFAULTS.rays, ...props.rays },
    flare: { ...DEFAULTS.flare, ...props.flare },
    sunTransform: { ...DEFAULTS.sunTransform, ...props.sunTransform },
    renderMode: props.renderMode ?? (reduceMotion ? 'css' : DEFAULTS.renderMode),
  };
}

// =============================================================================
// CSS fallback
// =============================================================================

function CssSun({ p }: { p: ResolvedProps }) {
  const { offsetX, offsetY, rotation, scale } = p.sunTransform;
  const { coreColor, midColor, edgeColor, intensity } = p.appearance;
  const { coreSize, rayLength, rayThickness, fluffiness, speed } = p.rays;
  const fl = p.flare;

  const dur = `${(40 / Math.max(0.1, speed)).toFixed(1)}s`;
  const rayDeg = Math.max(1, rayThickness * 15 + 1);
  const hg = ((30 - rayDeg) / 2).toFixed(1);
  const tg = (30 - parseFloat(hg)).toFixed(1);
  const raysGrad = `repeating-conic-gradient(transparent 0deg,transparent ${hg}deg,${midColor}BB 15deg,transparent ${tg}deg,transparent 30deg)`;
  const rayMask = `radial-gradient(circle,transparent ${Math.round(coreSize * 8 + 2)}%,white ${Math.round(coreSize * 8 + 12)}%,white ${Math.round(rayLength * 30 + 15)}%,transparent ${Math.round(rayLength * 30 + 30)}%)`;
  const fRad = (fl.direction * Math.PI) / 180;
  const rayPx = Math.round(rayLength * 400);
  const corePx = Math.round(rayLength * 180 + coreSize * 100);
  const ap: CSSProperties = { position: 'absolute', pointerEvents: 'none' };
  const cc = 'translate(-50%,-50%)';
  const sunLeft = `calc(50% + ${offsetX}px)`;
  const sunTop = `${offsetY}px`;

  const ghosts: ReactNode =
    fl.enabled && fl.strength > 0
      ? [0.12, 0.25, 0.4, 0.57, 0.73, 0.88].map((t, i) => {
          const dx = Math.cos(fRad) * t * fl.distance * 300;
          const dy = -Math.sin(fRad) * t * fl.distance * 300;
          const sz = Math.round(fl.roundSize * 60 * (0.3 + t * 0.8));
          const col = t < 0.5 ? fl.colorNear : fl.colorFar;
          return (
            <div
              key={i}
              style={{
                ...ap,
                left: `calc(50% + ${offsetX + dx}px)`,
                top: `${offsetY + dy}px`,
                transform: cc,
                width: `${sz}px`,
                aspectRatio: '1',
                borderRadius: '50%',
                background: `radial-gradient(circle,${col}55 0%,${col}22 60%,transparent 100%)`,
                opacity: (1 - t * 0.3) * fl.strength * 0.7,
              }}
            />
          );
        })
      : null;

  return (
    <>
      <style>{`@keyframes sun-ray-spin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{
          ...ap,
          left: sunLeft,
          top: sunTop,
          width: 0,
          height: 0,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            ...ap,
            width: `${rayPx}px`,
            aspectRatio: '1',
            top: '50%',
            left: '50%',
            transform: `${cc} scale(${scale}) rotate(${rotation}deg)`,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background: raysGrad,
              WebkitMaskImage: rayMask,
              maskImage: rayMask,
              animation: speed > 0 ? `sun-ray-spin ${dur} linear infinite` : undefined,
              opacity: Math.min(1, intensity * 0.55),
            }}
          />
        </div>
        <div
          style={{
            ...ap,
            width: `${corePx}px`,
            aspectRatio: '1',
            top: '50%',
            left: '50%',
            transform: `${cc} scale(${scale})`,
            background: `radial-gradient(circle,${coreColor} 0%,${midColor} ${Math.round(coreSize * 20 + 5)}%,${edgeColor} ${Math.round(coreSize * 20 + rayLength * 20 + 15)}%,transparent 100%)`,
            filter: fluffiness > 0.05 ? `blur(${Math.round(fluffiness * 10)}px)` : undefined,
            opacity: Math.min(1, intensity * 0.8),
          }}
        />
        <div
          style={{
            ...ap,
            width: `${Math.round(rayLength * 600)}px`,
            height: '3px',
            top: '50%',
            left: '50%',
            transform: `${cc} rotate(${rotation}deg)`,
            background: `linear-gradient(to right,transparent,${midColor} 30%,${coreColor} 50%,${midColor} 70%,transparent)`,
            filter: 'blur(2px)',
            opacity: Math.min(1, intensity * 0.3),
          }}
        />
      </div>
      {ghosts}
    </>
  );
}

// =============================================================================
// Component
// =============================================================================

/**
 * WebGL sun-ray + lens-flare shader (converted from Framer).
 * Renders fixed under page headers — decorative, non-interactive.
 */
export function SunRayShader(props: SunRayShaderProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const resolved = resolveProps(props, reduceMotion);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(resolved);
  propsRef.current = resolved;

  const useCss = resolved.renderMode === 'css';

  useEffect(() => {
    if (useCss) return;

    let raf = 0;
    let glCtx: WebGLRenderingContext | null = null;
    let glProg: WebGLProgram | null = null;
    let glBuf: WebGLBuffer | null = null;
    let resizeFn: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;
    let visible = true;

    const setup = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      const gl = (canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
      }) ||
        canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (!gl) return;
      glCtx = gl;
      gl.clearColor(0, 0, 0, 0);

      const precInfo = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const fragSrc =
        precInfo && precInfo.precision > 0
          ? FRAG_SRC
          : FRAG_SRC.replace('precision highp float', 'precision mediump float');

      const compile = (type: number, src: string) => {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        return sh;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);
      glProg = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      glBuf = buf;

      const locs = {
        uRes: gl.getUniformLocation(prog, 'uRes'),
        uContainerRes: gl.getUniformLocation(prog, 'uContainerRes'),
        uTime: gl.getUniformLocation(prog, 'uTime'),
        uIntensity: gl.getUniformLocation(prog, 'uIntensity'),
        uRotation: gl.getUniformLocation(prog, 'uRotation'),
        uScale: gl.getUniformLocation(prog, 'uScale'),
        uOffsetX: gl.getUniformLocation(prog, 'uOffsetX'),
        uOffsetY: gl.getUniformLocation(prog, 'uOffsetY'),
        uCoreSize: gl.getUniformLocation(prog, 'uCoreSize'),
        uRayLength: gl.getUniformLocation(prog, 'uRayLength'),
        uRayThickness: gl.getUniformLocation(prog, 'uRayThickness'),
        uFluffiness: gl.getUniformLocation(prog, 'uFluffiness'),
        uFlareAngle: gl.getUniformLocation(prog, 'uFlareAngle'),
        uFlareDistance: gl.getUniformLocation(prog, 'uFlareDistance'),
        uFlareRoundSize: gl.getUniformLocation(prog, 'uFlareRoundSize'),
        uFlareStrength: gl.getUniformLocation(prog, 'uFlareStrength'),
        uCore: gl.getUniformLocation(prog, 'uCore'),
        uMid: gl.getUniformLocation(prog, 'uMid'),
        uEdge: gl.getUniformLocation(prog, 'uEdge'),
        uFlareNear: gl.getUniformLocation(prog, 'uFlareNear'),
        uFlareFar: gl.getUniformLocation(prog, 'uFlareFar'),
      };

      const setUniforms = (
        p: ResolvedProps,
        t: number,
        d: number,
        cw: number,
        ch: number,
        w: number,
        h: number,
      ) => {
        gl.uniform2f(locs.uRes, w, h);
        gl.uniform2f(locs.uContainerRes, cw * d, ch * d);
        gl.uniform1f(locs.uTime, t);
        gl.uniform1f(locs.uIntensity, p.appearance.intensity);
        gl.uniform1f(locs.uScale, p.sunTransform.scale);
        gl.uniform1f(locs.uOffsetX, p.sunTransform.offsetX * d);
        gl.uniform1f(locs.uOffsetY, p.sunTransform.offsetY * d);
        gl.uniform1f(locs.uRotation, (p.sunTransform.rotation * Math.PI) / 180);
        gl.uniform1f(locs.uCoreSize, p.rays.coreSize);
        gl.uniform1f(locs.uRayLength, p.rays.rayLength);
        gl.uniform1f(locs.uRayThickness, p.rays.rayThickness);
        gl.uniform1f(locs.uFluffiness, p.rays.fluffiness);
        gl.uniform1f(locs.uFlareAngle, (p.flare.direction * Math.PI) / 180);
        gl.uniform1f(locs.uFlareDistance, p.flare.distance);
        gl.uniform1f(locs.uFlareRoundSize, p.flare.roundSize);
        gl.uniform1f(locs.uFlareStrength, p.flare.enabled ? p.flare.strength : 0);
        gl.uniform3fv(locs.uCore, colorRGB(p.appearance.coreColor));
        gl.uniform3fv(locs.uMid, colorRGB(p.appearance.midColor));
        gl.uniform3fv(locs.uEdge, colorRGB(p.appearance.edgeColor));
        gl.uniform3fv(locs.uFlareNear, colorRGB(p.flare.colorNear));
        gl.uniform3fv(locs.uFlareFar, colorRGB(p.flare.colorFar));
      };

      let cW = 0;
      let cH = 0;
      let ctW = 0;
      let ctH = 0;
      let dpr = 1;

      const resize = () => {
        const cw = wrap.clientWidth;
        const ch = wrap.clientHeight;
        const safeDpr = 4000 / Math.max(cw + 1200, ch + 1200);
        const d = Math.min(2.0, window.devicePixelRatio || 1, safeDpr);
        const w = Math.round((cw + 1200) * d);
        const h = Math.round((ch + 1200) * d);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          cW = w;
          cH = h;
          ctW = cw;
          ctH = ch;
          dpr = d;
          gl.viewport(0, 0, w, h);
        }
      };
      resize();
      window.addEventListener('resize', resize);
      resizeFn = resize;

      observer = new IntersectionObserver(
        ([e]) => {
          visible = e?.isIntersecting ?? false;
        },
        { threshold: 0 },
      );
      observer.observe(wrap);

      const start = performance.now();

      const render = () => {
        raf = requestAnimationFrame(render);
        if (!visible || document.hidden || propsRef.current.renderMode === 'css') return;

        gl.clear(gl.COLOR_BUFFER_BIT);
        const speed = propsRef.current.rays.speed;
        const t = ((performance.now() - start) / 1000) * speed;
        setUniforms(propsRef.current, t, dpr, ctW, ctH, cW, cH);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      render();
    };

    const ric =
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback
        : (cb: IdleRequestCallback) => setTimeout(() => cb({} as IdleDeadline), 0);
    const cric =
      typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : clearTimeout;
    const handle = ric(setup, { timeout: 1000 }) as number;

    return () => {
      cric(handle as number);
      cancelAnimationFrame(raf);
      observer?.disconnect();
      if (resizeFn) window.removeEventListener('resize', resizeFn);
      if (glCtx && glProg) glCtx.deleteProgram(glProg);
      if (glCtx && glBuf) glCtx.deleteBuffer(glBuf);
    };
  }, [useCss]);

  return (
    <div
      ref={wrapRef}
      className={cn(styles.root, props.className)}
      style={{
        ...props.style,
        mixBlendMode: resolved.appearance.blendMode,
      }}
      aria-hidden="true"
    >
      {useCss ? (
        <CssSun p={resolved} />
      ) : (
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
      )}
    </div>
  );
}
