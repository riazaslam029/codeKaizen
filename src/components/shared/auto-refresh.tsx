"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-fetches server data on an interval while the tab is visible (live monitoring without websockets). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [last, setLast] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && Date.now() - last >= seconds * 1000) {
        router.refresh();
        setLast(Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
  }, [last, router, seconds]);

  const left = Math.max(0, seconds - Math.floor((now - last) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="off">
      <RefreshCw className="size-3.5" aria-hidden /> Live · refresh in {left}s
    </span>
  );
}
