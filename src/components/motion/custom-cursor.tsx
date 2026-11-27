"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dual-layer Veyqora cursor:
 * - Zero-lag 8px mix-blend-difference dot
 * - Lerped outer ring that morphs into an 88px label pill on [data-cursor-text] targets.
 * Disabled on touch devices and prefers-reduced-motion.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string>("");
  const [mode, setMode] = useState<"default" | "hover" | "label">("default");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduced) return;

    document.documentElement.classList.add("has-custom-cursor");

    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      setVisible(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
      }

      const target = e.target as HTMLElement | null;
      const cursorTextEl = target?.closest<HTMLElement>("[data-cursor-text]");
      if (cursorTextEl) {
        setLabel(cursorTextEl.dataset.cursorText ?? "");
        setMode("label");
        return;
      }
      const interactive = target?.closest("a, button, [role='button'], input, select, textarea");
      setLabel("");
      setMode(interactive ? "hover" : "default");
    };

    const onLeave = () => setVisible(false);

    const tick = () => {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }
      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    raf = window.requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] size-2 rounded-full bg-white mix-blend-difference"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          transition:
            "width 260ms cubic-bezier(0.16, 1, 0.3, 1), height 260ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms ease, border-color 220ms ease",
        }}
        className={
          mode === "label"
            ? "pointer-events-none fixed top-0 left-0 z-[9998] flex size-[86px] items-center justify-center rounded-full bg-white font-mono-code text-[10px] font-semibold tracking-widest text-black uppercase shadow-2xl"
            : mode === "hover"
              ? "pointer-events-none fixed top-0 left-0 z-[9998] size-12 rounded-full border border-white/40 bg-white/10 backdrop-blur-[1px]"
              : "pointer-events-none fixed top-0 left-0 z-[9998] size-8 rounded-full border border-white/25"
        }
      >
        {mode === "label" ? label : null}
      </div>
    </>
  );
}
