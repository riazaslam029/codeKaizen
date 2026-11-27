"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

/** Light / Dark / System, persisted in localStorage; the inline script next-themes injects prevents a flash. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="ckz-theme">
      {children}
    </NextThemes>
  );
}
