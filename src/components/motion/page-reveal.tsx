"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * Staggers direct children or `.reveal-item` descendants on mount using GSAP.
 * Under `prefers-reduced-motion: reduce`, renders immediately with zero opacity/transform delay.
 */
export function PageReveal({
  children,
  className,
  selector = ".reveal-item",
  stagger = 0.045,
}: {
  children: ReactNode;
  className?: string;
  selector?: string;
  stagger?: number;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets = scope.current?.querySelectorAll(selector);
        if (!targets || targets.length === 0) return;
        gsap.from(targets, {
          y: 14,
          opacity: 0,
          duration: 0.42,
          stagger,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });
      });
    },
    { scope },
  );

  return (
    <div ref={scope} className={cn(className)}>
      {children}
    </div>
  );
}
