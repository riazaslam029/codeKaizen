"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type MagneticProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
};

/**
 * Veyqora-style magnetic wrapper: subtle pointer pull (translate3d) on desktop,
 * spring return on leave, disabled on coarse pointers and reduced-motion.
 */
export function MagneticWrap({ children, className, strength = 0.25 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0, active: false });

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    setOffset({ x: Math.max(-10, Math.min(10, dx)), y: Math.max(-10, Math.min(10, dy)), active: true });
  };

  const onLeave = () => setOffset({ x: 0, y: 0, active: false });

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        transform: `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)`,
        transition: offset.active
          ? "transform 100ms ease-out"
          : "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={cn("inline-block will-change-transform", className)}
    >
      {children}
    </div>
  );
}
