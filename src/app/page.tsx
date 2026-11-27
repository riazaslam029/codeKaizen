import { VeyqoraLanding } from "@/components/landing/veyqora-landing";

/**
 * Signed-in users are routed directly to their role workspace by src/proxy.ts.
 * Visitors and contest judges see the CodeKaizen Veyqora-inspired showcase landing page.
 */
export default function Home() {
  return <VeyqoraLanding />;
}
