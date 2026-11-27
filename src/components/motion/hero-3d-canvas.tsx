"use client";

import { useEffect, useRef } from "react";

type Hero3DCanvasProps = {
  /** Compact mode tones down the geodesic core for split panels such as /login. */
  variant?: "hero" | "panel";
  className?: string;
};

type Vec3 = { x: number; y: number; z: number };

const PHI = (1 + Math.sqrt(5)) / 2;

const ICOSA_VERTS: Vec3[] = [
  { x: -1, y: PHI, z: 0 },
  { x: 1, y: PHI, z: 0 },
  { x: -1, y: -PHI, z: 0 },
  { x: 1, y: -PHI, z: 0 },
  { x: 0, y: -1, z: PHI },
  { x: 0, y: 1, z: PHI },
  { x: 0, y: -1, z: -PHI },
  { x: 0, y: 1, z: -PHI },
  { x: PHI, y: 0, z: -1 },
  { x: PHI, y: 0, z: 1 },
  { x: -PHI, y: 0, z: -1 },
  { x: -PHI, y: 0, z: 1 },
].map((v) => {
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
});

const ICOSA_EDGES: [number, number][] = [
  [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
  [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
  [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
  [4, 9], [9, 8], [8, 6], [6, 2], [2, 4],
  [1, 9], [5, 4], [11, 2], [10, 6], [7, 8],
  [9, 5], [4, 11], [2, 10], [6, 7], [8, 1],
];

function rotatePoint(p: Vec3, ax: number, ay: number, az: number): Vec3 {
  // X-axis rotation
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const y1 = p.y * cosX - p.z * sinX;
  const z1 = p.y * sinX + p.z * cosX;

  // Y-axis rotation
  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  const x2 = p.x * cosY + z1 * sinY;
  const z2 = -p.x * sinY + z1 * cosY;

  // Z-axis rotation
  const cosZ = Math.cos(az);
  const sinZ = Math.sin(az);
  return {
    x: x2 * cosZ - y1 * sinZ,
    y: x2 * sinZ + y1 * cosZ,
    z: z2,
  };
}

/**
 * High-FPS 3D perspective telemetry canvas inspired by Veyqora Labs:
 * 1. Lerped radial cursor ambient glow (#0066FF -> #7B3FF2)
 * 2. Cursor-reactive 3D undulating wireframe wave mesh
 * 3. Rotating 3D geodesic vault core + orbital telemetry rings + drifting 3D nodes
 */
export function Hero3DCanvas({ variant = "hero", className = "" }: Hero3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rafId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const pointer = {
      targetX: 0.65,
      targetY: 0.45,
      x: 0.65,
      y: 0.45,
      active: false,
    };

    const particles = Array.from({ length: variant === "hero" ? 20 : 12 }, (_, i) => ({
      phase: (i / 20) * Math.PI * 2,
      radius: 0.72 + (i % 5) * 0.18,
      speed: 0.25 + (i % 4) * 0.12,
      tilt: ((i % 7) - 3) * 0.28,
      isBlue: i % 2 === 0,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.targetX = (e.clientX - rect.left) / rect.width;
      pointer.targetY = (e.clientY - rect.top) / rect.height;
      pointer.active = true;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let t = 0;

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth cursor lerp (Veyqora 0.05 smoothing)
      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;

      const glowX = pointer.x * width;
      const glowY = pointer.y * height;

      // 1. Lerped radial cursor ambient glow
      const glowR = Math.max(width, height) * 0.58;
      const grad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
      grad.addColorStop(0, "rgba(0, 102, 255, 0.13)");
      grad.addColorStop(0.45, "rgba(123, 63, 242, 0.05)");
      grad.addColorStop(1, "rgba(5, 7, 11, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Cursor-reactive 3D wave wireframe mesh
      const cols = variant === "hero" ? 26 : 16;
      const rows = variant === "hero" ? 14 : 10;
      const cellW = width / (cols - 1);
      const cellH = height / (rows - 1);

      ctx.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        for (let c = 0; c < cols; c++) {
          const baseX = c * cellW;
          const baseY = r * cellH;
          const dx = baseX - glowX;
          const dy = baseY - glowY;
          const dist = Math.hypot(dx, dy);
          const prox = Math.max(0, 1 - dist / 360);
          const wave = Math.sin(c * 0.35 + t * 1.1) * Math.cos(r * 0.45 + t * 0.8) * (8 + prox * 22);
          const px = baseX + Math.sin(r * 0.4 + t * 0.5) * 4;
          const py = baseY + wave;
          if (c === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.032)";
        ctx.stroke();
      }

      // 3. Rotating 3D Geodesic Vault Core
      const scrollRatio = Math.min(1.5, window.scrollY / Math.max(1, height));
      const centerX = variant === "hero" ? (width > 960 ? width * 0.74 : width * 0.52) : width * 0.52;
      const centerY = variant === "hero" ? height * 0.46 - scrollRatio * 48 : height * 0.36;
      const baseScale = Math.min(width, height) * (variant === "hero" ? (width > 960 ? 0.25 : 0.22) : 0.26);
      const fov = 3.2;

      const ax = t * 0.24 + (pointer.y - 0.5) * 0.75 + scrollRatio * 0.5;
      const ay = t * 0.36 + (pointer.x - 0.5) * 0.9;
      const az = t * 0.12;

      const projected = ICOSA_VERTS.map((v) => {
        const rv = rotatePoint(v, ax, ay, az);
        const depth = fov / (fov - rv.z);
        return {
          x: centerX + rv.x * baseScale * depth,
          y: centerY + rv.y * baseScale * depth,
          z: rv.z,
          depth,
        };
      });

      // Outer geodesic wireframe
      for (const [a, b] of ICOSA_EDGES) {
        const p1 = projected[a]!;
        const p2 = projected[b]!;
        const avgZ = (p1.z + p2.z) * 0.5;
        const alpha = Math.max(0.08, Math.min(0.42, 0.22 + avgZ * 0.16));
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = avgZ > 0 ? `rgba(77, 148, 255, ${alpha})` : `rgba(123, 63, 242, ${alpha * 0.75})`;
        ctx.lineWidth = avgZ > 0 ? 1.25 : 0.85;
        ctx.stroke();
      }

      // Inner counter-rotating wireframe vault
      const innerProj = ICOSA_VERTS.map((v) => {
        const rv = rotatePoint(v, -ax * 1.15, -ay * 1.2, az * 1.4);
        const depth = fov / (fov - rv.z);
        return {
          x: centerX + rv.x * baseScale * 0.52 * depth,
          y: centerY + rv.y * baseScale * 0.52 * depth,
          z: rv.z,
        };
      });

      for (const [a, b] of ICOSA_EDGES) {
        const p1 = innerProj[a]!;
        const p2 = innerProj[b]!;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Two tilted 3D orbital telemetry rings
      for (let ring = 0; ring < 2; ring++) {
        const segs = 48;
        ctx.beginPath();
        for (let s = 0; s <= segs; s++) {
          const theta = (s / segs) * Math.PI * 2;
          const rScale = ring === 0 ? 1.32 : 1.54;
          const p: Vec3 = {
            x: Math.cos(theta) * rScale,
            y: Math.sin(theta) * rScale * 0.36,
            z: Math.sin(theta) * rScale * 0.72,
          };
          const rp = rotatePoint(
            p,
            ring === 0 ? ax * 0.6 + 0.5 : -ax * 0.45 - 0.35,
            ay * 0.5 + ring * 1.1,
            ring === 0 ? 0.3 : -0.45,
          );
          const depth = fov / (fov - rp.z * 0.5);
          const sx = centerX + rp.x * baseScale * depth;
          const sy = centerY + rp.y * baseScale * depth;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = ring === 0 ? "rgba(0, 102, 255, 0.24)" : "rgba(123, 63, 242, 0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3D vertices & orbital telemetry particles
      for (const p of projected) {
        const r = Math.max(1.4, p.depth * 1.9);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.z > 0 ? "rgba(147, 197, 253, 0.75)" : "rgba(255, 255, 255, 0.3)";
        ctx.fill();
      }

      for (const pt of particles) {
        const angle = pt.phase + t * pt.speed;
        const p3: Vec3 = {
          x: Math.cos(angle) * pt.radius * 1.35,
          y: Math.sin(angle * 0.8) * pt.tilt,
          z: Math.sin(angle) * pt.radius * 1.35,
        };
        const rp = rotatePoint(p3, ax * 0.35, ay * 0.35, 0);
        const depth = fov / (fov - rp.z * 0.45);
        const sx = centerX + rp.x * baseScale * depth;
        const sy = centerY + rp.y * baseScale * depth;
        const nearCursor = Math.hypot(sx - glowX, sy - glowY) < 280;

        ctx.beginPath();
        ctx.arc(sx, sy, nearCursor ? 2.2 : 1.6, 0, Math.PI * 2);
        ctx.fillStyle = pt.isBlue
          ? nearCursor
            ? "rgba(77, 148, 255, 0.9)"
            : "rgba(0, 102, 255, 0.55)"
          : nearCursor
            ? "rgba(255, 255, 255, 0.8)"
            : "rgba(255, 255, 255, 0.35)";
        ctx.fill();

        if (nearCursor) {
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 102, 255, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      if (!reducedMotion) {
        t += 0.012;
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
