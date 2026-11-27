"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tilt3DProps = {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
};

/**
 * Interactive 3D perspective card with cursor-tracked rotateX/rotateY and subtle specular glare.
 * Automatically degrades to flat static layout on coarse touch pointers or reduced-motion.
 */
export function Tilt3D({ children, className, maxTilt = 7, glare = true }: Tilt3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ transform: string; glareX: number; glareY: number; active: boolean }>({
    transform: "perspective(1100px) rotateX(0deg) rotateY(0deg) translate3d(0,0,0)",
    glareX: 50,
    glareY: 50,
    active: false,
  });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * (maxTilt * 2);
    const ry = (px - 0.5) * (maxTilt * 2);
    setStyle({
      transform: `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0, -3px, 8px)`,
      glareX: px * 100,
      glareY: py * 100,
      active: true,
    });
  };

  const onLeave = () => {
    setStyle({
      transform: "perspective(1100px) rotateX(0deg) rotateY(0deg) translate3d(0,0,0)",
      glareX: 50,
      glareY: 50,
      active: false,
    });
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        transform: style.transform,
        transition: style.active
          ? "transform 110ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
        transformStyle: "preserve-3d",
      }}
      className={cn("relative will-change-transform", className)}
    >
      {glare && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: style.active ? 1 : 0,
            background: `radial-gradient(420px circle at ${style.glareX}% ${style.glareY}%, rgba(0, 102, 255, 0.14), transparent 60%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
