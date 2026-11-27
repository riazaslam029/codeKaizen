"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck2,
  LockKeyhole,
  Menu,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CustomCursor } from "@/components/motion/custom-cursor";
import { Hero3DCanvas } from "@/components/motion/hero-3d-canvas";
import { MagneticWrap } from "@/components/motion/magnetic-button";
import { Tilt3D } from "@/components/motion/tilt-3d";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SECTIONS = [
  { id: "hero", num: "01", label: "INTRO", subtitle: "Failure-Resilient Engine" },
  { id: "manifesto", num: "02", label: "RESILIENCE", subtitle: "Zero Lost Answers" },
  { id: "capabilities", num: "03", label: "MODULES", subtitle: "Enforced Architecture" },
  { id: "systems", num: "04", label: "SIMULATOR", subtitle: "Live Outbox & Specs" },
  { id: "pipeline", num: "05", label: "PIPELINE", subtitle: "Author to Verify" },
] as const;

const MANIFESTO_WORDS =
  "When a candidate loses Wi-Fi mid-exam, refreshes their browser, or faces a flaky mobile hotspot, the assessment cannot fracture. Every keystroke is queued locally with monotonic revision stamps, synced through idempotent back-off, and bound to an authoritative server clock.".split(
    " ",
  );

const RULES = [
  {
    code: "RULE 01",
    title: "Offline-First Local Outbox",
    desc: "Answers persist to localStorage the instant a candidate selects or types. Network drops transition seamlessly to Offline mode without blocking progress.",
    metric: "0ms input loss",
  },
  {
    code: "RULE 02",
    title: "Monotonic Revision Guard",
    desc: "Every question carries a strictly increasing revision counter. Out-of-order retries never overwrite newer answers in PostgreSQL.",
    metric: "revision > stored",
  },
  {
    code: "RULE 03",
    title: "Server-Authoritative Clock",
    desc: "Deadlines live in expiresAt on Neon Postgres. Reloads and new tabs emit ATTEMPT_RESUMED and never grant a single extra millisecond.",
    metric: "3s grace · strict lock",
  },
];

const CAPABILITIES = [
  {
    num: "01",
    title: "Failure-Resilient Exam Delivery",
    summary:
      "Built for Track 5.3: candidates survive total network blackouts, browser crashes, and duplicate submit clicks while examiners receive full telemetry.",
    pills: ["Local Outbox", "Exponential Backoff", "Idempotent Revisions", "Lazy Finalisation"],
    deliverables: [
      "Client outbox queues answers on offline/5xx responses",
      "Automatic exponential backoff flush on reconnect",
      "ATTEMPT_RESUMED & NETWORK_LOSS incident logging",
      "Conditional SQL UPDATE preventing duplicate submits",
      "Partial unique index guaranteeing one open attempt",
      "Frozen question_snapshot protecting live exams from edits",
    ],
  },
  {
    num: "02",
    title: "Server-Enforced Role Isolation",
    summary:
      "Every page, Server Action, and Route Handler re-verifies signed HS256 JWT sessions and database session_version on every single request.",
    pills: ["Admin", "Examiner", "Candidate", "DAL Enforcement"],
    deliverables: [
      "Strict ownership isolation between examiners",
      "Instant global token revocation via session_version",
      "Account restriction interceptor with live 45s polling",
      "Zero answer-key leakage (toCandidateQuestions allow-list)",
      "Protected open attempts preserved during restriction",
      "Full immutable audit_logs trail for administrative actions",
    ],
  },
  {
    num: "03",
    title: "Authoring, Monitoring & Hybrid Grading",
    summary:
      "Complete lifecycle from Draft to Published, Ongoing, Completed, and Archived — with real-time monitoring, bulk CSV/JSON import, and Recharts analytics.",
    pills: ["5 Question Types", "Dry-Run Import", "Live Monitoring", "Question Analytics"],
    deliverables: [
      "Single, multi-select (partial/all), true/false, short, essay",
      "100-question dry-run CSV/JSON validator with row errors",
      "Live examiner monitoring separating network vs integrity",
      "Manual essay grading queue with examiner overrides",
      "Publish readiness checklist blocking premature release",
      "Skip-rate & difficulty-vs-accuracy diagnostic charts",
    ],
  },
  {
    num: "04",
    title: "Cryptographic PDF & Public Verification",
    summary:
      "Server-generated PDF result certificates embedded with verifiable QR codes, backed by a privacy-preserving public /verify endpoint.",
    pills: ["pdf-lib", "QR Code", "Privacy-Safe /verify", "Revocation Ready"],
    deliverables: [
      "Zero-external-API server-side PDF certificate generation",
      "Embedded QR verification URL & human-readable code",
      "Public /verify/[code] status: Valid, Revoked, or Invalid",
      "Zero PII exposure: hides candidate name & score publicly",
      "Instant withdrawal/revocation when results are recalled",
      "Topic-by-topic breakdown and question review for students",
    ],
  },
];

const PIPELINE_STEPS = [
  {
    phase: "PHASE 01",
    title: "Author",
    window: "STEP 01 · QUESTION BANK & WINDOWING",
    desc: "Import 100+ questions via dry-run CSV/JSON, configure partial or negative marking, enroll cohorts, and validate schedules in sandbox preview.",
    points: [
      "5 question formats with difficulty & topic tags",
      "Deterministic shuffle for questions & options",
      "Sandboxed preview never pollutes attempt tables",
      "Scheduled UTC windows rendered in local timezone",
    ],
  },
  {
    phase: "PHASE 02",
    title: "Deliver",
    window: "STEP 02 · RESILIENT WORKSPACE",
    desc: "At start, questions and marking schemes freeze into question_snapshot. Candidates work with keyboard shortcuts, scratchpad, and offline outbox.",
    points: [
      "High-contrast, dark, and light accessible themes",
      "Keyboard navigation (N / P / 1–9 / F / ?) & review grid",
      "Offline outbox + exponential retry countdown",
      "Server-synced deadline with zero client clock trust",
    ],
  },
  {
    phase: "PHASE 03",
    title: "Grade",
    window: "STEP 03 · TELEMETRY & PUBLISHING",
    desc: "Objective items score deterministically. Examiners review written essays, inspect connectivity timelines, and unlock publication via checklist.",
    points: [
      "Lazy finalisation grades abandoned expired attempts",
      "Disruption timeline separates connectivity from conduct",
      "Per-question skip rate & common wrong-answer heat",
      "One-click publish or withhold per result",
    ],
  },
  {
    phase: "PHASE 04",
    title: "Verify",
    window: "STEP 04 · AUDITABLE CREDENTIALS",
    desc: "Published results issue a server-signed PDF report with QR verification. Any institution confirms authenticity in milliseconds at /verify.",
    points: [
      "Downloadable server-rendered PDF via pdf-lib",
      "Unique verification token (CKZ-XXXX-XXXX-XXXX)",
      "Privacy-preserving verification hides student PII",
      "Immediate revocation sync if scores are updated",
    ],
  },
];

const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Neon Postgres",
  "Drizzle ORM",
  "GSAP ScrollTrigger",
  "Lenis Smooth Scroll",
  "Tailwind CSS 4",
  "Zod 4 Validation",
  "pdf-lib + QRCode",
  "Recharts Analytics",
  "Playwright + Axe AA",
  "HS256 Session Guard",
  "Local Outbox Sync",
];

type SimEvent = { id: number; time: string; tag: string; detail: string; tone: "ok" | "warn" | "info" };

export function VeyqoraLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [openCap, setOpenCap] = useState(0);
  const [activePhase, setActivePhase] = useState(0);
  const [specsOpen, setSpecsOpen] = useState(false);

  // Interactive Track 5.3 Outbox Simulator state
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { val: string; rev: number; synced: boolean }>>({
    Q1: { val: "B", rev: 1, synced: true },
    Q2: { val: "A", rev: 1, synced: true },
    Q3: { val: "", rev: 0, synced: true },
  });
  const [simLogs, setSimLogs] = useState<SimEvent[]>([
    { id: 1, time: "18:54:02", tag: "SNAPSHOT_FROZEN", detail: "question_snapshot locked · expiresAt synced", tone: "info" },
    { id: 2, time: "18:54:08", tag: "SAVED_SERVER", detail: "Q1=B (rev 1) · Q2=A (rev 1) persisted", tone: "ok" },
  ]);

  const pushLog = (tag: string, detail: string, tone: SimEvent["tone"]) => {
    const now = new Date().toTimeString().slice(0, 8);
    setSimLogs((prev) => [{ id: Date.now() + Math.random(), time: now, tag, detail, tone }, ...prev].slice(0, 5));
  };

  const selectSimAnswer = (q: string, val: string) => {
    setAnswers((prev) => {
      const nextRev = (prev[q]?.rev ?? 0) + 1;
      const synced = !offline;
      return { ...prev, [q]: { val, rev: nextRev, synced } };
    });
    if (offline) {
      pushLog("LOCAL_OUTBOX", `${q}=${val} queued locally (offline · will sync)`, "warn");
    } else {
      pushLog("IDEMPOTENT_SYNC", `${q}=${val} committed · revision > stored`, "ok");
    }
  };

  const toggleNetwork = () => {
    if (!offline) {
      setOffline(true);
      pushLog("NETWORK_LOSS", "Connection dropped · outbox armed · server clock active", "warn");
    } else {
      setOffline(false);
      const pending = Object.entries(answers).filter(([, v]) => !v.synced);
      if (pending.length > 0) {
        setSyncing(true);
        pushLog("RECONNECTING", `Flushing ${pending.length} queued revision(s) via backoff…`, "info");
        setTimeout(() => {
          setAnswers((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
              next[k] = { ...next[k]!, synced: true };
            }
            return next;
          });
          setSyncing(false);
          pushLog("RECONNECTED", `0 answers lost · ${pending.length} outbox item(s) synced`, "ok");
        }, 550);
      } else {
        pushLog("RECONNECTED", "Link restored · server clock verified", "ok");
      }
    }
  };

  // Lenis smooth scroll + GSAP ScrollTrigger sync
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onScroll = () => setScrolled(window.scrollY > 36);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (reduced) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Section IntersectionObserver for bottom HUD
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = SECTIONS.findIndex((s) => s.id === entry.target.id);
            if (idx !== -1) setActiveSection(idx);
          }
        }
      },
      { rootMargin: "-30% 0px -30% 0px" },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Escape closes navigation overlay or specs modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSpecsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // GSAP Hero Choreography, Parallax Scrub, and Manifesto Word-by-Word Scrub
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".hero-stagger", {
          y: 28,
          opacity: 0,
          duration: 0.72,
          stagger: 0.08,
          ease: "power4.out",
          clearProps: "transform,opacity",
        });

        gsap.to(".hero-parallax", {
          y: -90,
          scale: 0.97,
          opacity: 0.35,
          ease: "none",
          scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });

        gsap.fromTo(
          ".intro-word",
          { color: "rgba(255, 255, 255, 0.18)" },
          {
            color: "#FFFFFF",
            stagger: 0.045,
            ease: "none",
            scrollTrigger: {
              trigger: "#manifesto-copy",
              start: "top 82%",
              end: "bottom 52%",
              scrub: 0.8,
            },
          },
        );
      });
    },
    { scope: rootRef },
  );

  const scrollToSection = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, { offset: -20 });
    } else {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const pendingCount = Object.values(answers).filter((a) => !a.synced).length;

  return (
    <div ref={rootRef} className="dark relative min-h-screen overflow-x-clip bg-[#05070B] text-[#F5F5F7]">
      <div className="film-grain" aria-hidden="true" />
      <CustomCursor />

      {/* Fixed Frosted Header */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-500",
          scrolled ? "border-b border-white/[0.08] bg-[#05070B]/80 py-3.5 backdrop-blur-md shadow-2xl" : "bg-transparent py-5 sm:py-6",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="group inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-[#4D94FF]">
            <span className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-[#0A0E1A] shadow-[0_0_20px_rgba(0,102,255,0.22)] transition-colors group-hover:border-[#0066FF]/60">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                <path
                  d="M4.5 7.5L12 3.5L19.5 7.5V16.5L12 20.5L4.5 16.5V7.5Z"
                  fill="none"
                  stroke="#0066FF"
                  strokeWidth="1.8"
                />
                <path d="M8.5 12.2L11 14.7L15.8 9.6" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="leading-none">
              <span className="font-display block text-base font-bold tracking-tight text-white">
                CODEKAIZEN<sup className="ml-0.5 text-[10px] text-[#4D94FF]">®</sup>
              </span>
              <span className="font-mono-code block text-[10px] tracking-[0.2em] text-slate-400 uppercase">EXAMS // 5.3</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/verify"
              className="hidden whitespace-nowrap rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 font-mono-code text-[11px] tracking-widest text-slate-300 uppercase transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white sm:inline-flex"
            >
              Verify PDF
            </Link>
            <MagneticWrap>
              <Link
                href="/login"
                className="glow-cta inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-2 font-mono-code text-[11px] font-semibold tracking-wider text-black uppercase hover:bg-[#0066FF] hover:text-white sm:px-4"
              >
                Sign In <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
              </Link>
            </MagneticWrap>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Open directory navigation"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.14] bg-white/[0.05] px-3 py-2 font-mono-code text-[11px] tracking-widest text-white uppercase transition-colors hover:border-[#0066FF]/50 hover:bg-white/[0.1] sm:gap-2 sm:px-4"
            >
              <span>MENU</span>
              {menuOpen ? <X className="size-3.5 shrink-0" aria-hidden="true" /> : <Menu className="size-3.5 shrink-0" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* Dual-Curtain Full-Screen Directory Navigation Overlay */}
      <div
        aria-hidden={!menuOpen}
        className={cn(
          "fixed inset-0 z-50 transition-all duration-500",
          menuOpen ? "pointer-events-auto visible" : "pointer-events-none invisible",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1/2 origin-top bg-[#05070B]/95 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)]",
            menuOpen ? "scale-y-100" : "scale-y-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 h-1/2 origin-bottom bg-[#05070B]/95 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)]",
            menuOpen ? "scale-y-100" : "scale-y-0",
          )}
        />
        <div
          className={cn(
            "relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-between px-6 py-8 transition-opacity duration-300 sm:px-10",
            menuOpen ? "opacity-100 delay-150" : "opacity-0",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-code text-xs tracking-[0.2em] text-[#4D94FF] uppercase">[ DIRECTORY NAVIGATION ]</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-mono-code text-xs text-white uppercase hover:border-white/40"
            >
              Close <X className="size-3.5" />
            </button>
          </div>

          <nav aria-label="Showcase sections" className="my-auto space-y-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className="group flex w-full items-baseline justify-between border-b border-white/[0.08] py-3.5 text-left transition-colors hover:border-[#0066FF]/50"
              >
                <span className="flex items-baseline gap-5">
                  <span className="font-mono-code text-xs text-[#4D94FF]">{s.num}</span>
                  <span className="font-display text-3xl font-bold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-2 sm:text-5xl">
                    {s.label}
                  </span>
                </span>
                <span className="hidden font-mono-code text-xs text-slate-400 uppercase sm:inline">{s.subtitle}</span>
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-6">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-[#0066FF] px-5 py-2.5 font-mono-code text-xs font-semibold text-white uppercase hover:bg-[#1a75ff]"
              >
                Enter Platform ↗
              </Link>
              <Link
                href="/verify"
                onClick={() => setMenuOpen(false)}
                className="rounded-full border border-white/15 px-5 py-2.5 font-mono-code text-xs text-slate-200 uppercase hover:border-white/40"
              >
                Verify Report
              </Link>
            </div>
            <span className="font-mono-code text-[11px] text-emerald-400">● SYS.OPERATIONAL /// TECHNOVERSE 5.0</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main">
        {/* SECTION 01: HERO */}
        <section id="hero" className="relative flex min-h-screen flex-col justify-between overflow-hidden pt-28 pb-20 sm:pt-32">
          <Hero3DCanvas variant="hero" className="opacity-85" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 size-[460px] rounded-full bg-[#0066FF]/12 blur-[140px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-10 size-[420px] rounded-full bg-[#7B3FF2]/10 blur-[140px]"
          />

          <div className="hero-parallax relative z-10 mx-auto my-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="hero-stagger inline-flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-[#0A0E1A]/80 px-3.5 py-1.5 backdrop-blur-md">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="font-mono-code text-[11px] tracking-[0.16em] text-slate-300 uppercase">
                TRACK 5.3 SPECIFICATION <span className="text-white/30">|</span> FAILURE-RESILIENT EXAMS
              </span>
            </div>

            <h1 className="hero-stagger font-display mt-7 text-[clamp(2.75rem,8.1vw,8.4rem)] leading-[0.88] font-bold tracking-[-0.035em] uppercase">
              <span className="block text-white">EXAMINATIONS</span>
              <span className="block bg-gradient-to-b from-white via-white/90 to-white/55 bg-clip-text text-transparent">
                BUILT FOR
              </span>
              <span className="text-gradient-veyqora block">RESILIENCE.</span>
            </h1>

            <p className="hero-stagger mt-7 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Next-generation assessment platform engineered for zero-loss continuity. Candidates survive Wi-Fi drops, tab crashes, and
              flaky networks without losing a single answer or gaining extra server time.
            </p>

            <div className="hero-stagger mt-7 flex flex-wrap gap-2">
              {["LOCAL OUTBOX SYNC", "MONOTONIC REVISIONS", "SERVER-KEPT TIMER", "QR VERIFIED PDF"].map((pill) => (
                <span
                  key={pill}
                  className="rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-1 font-mono-code text-[11px] tracking-wider text-slate-300"
                >
                  {pill}
                </span>
              ))}
            </div>

            <div className="hero-stagger mt-9 flex flex-wrap items-center gap-4">
              <MagneticWrap>
                <Link
                  href="/login"
                  className="glow-cta inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-mono-code text-xs font-semibold tracking-wider text-black uppercase hover:bg-[#0066FF] hover:text-white"
                >
                  Launch Platform <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </MagneticWrap>
              <button
                type="button"
                onClick={() => scrollToSection("systems")}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] px-6 py-3.5 font-mono-code text-xs tracking-wider text-white uppercase transition-colors hover:border-white/30 hover:bg-white/[0.09]"
              >
                Live Outbox Simulator <ArrowDown className="size-4" aria-hidden="true" />
              </button>
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 px-3 py-2 font-mono-code text-xs tracking-wider text-slate-300 uppercase transition-colors hover:text-[#4D94FF]"
              >
                <QrCode className="size-4" aria-hidden="true" /> Verify Certificate
              </Link>
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-12 flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] px-5 pt-5 sm:px-8 lg:px-12">
            <span className="font-mono-code text-[11px] tracking-[0.18em] text-slate-400 uppercase">
              ZERO HYPOTHETICALS · 100% SERVER-ENFORCED MONOLITH
            </span>
            <button
              type="button"
              onClick={() => scrollToSection("manifesto")}
              className="inline-flex items-center gap-2 font-mono-code text-[11px] tracking-[0.18em] text-slate-300 uppercase hover:text-white"
            >
              SCROLL TO EXPLORE <ArrowDown className="size-3.5 animate-bounce" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* SECTION 02: MANIFESTO + 3D RULE CARDS */}
        <section id="manifesto" className="border-t border-white/[0.08] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="font-mono-code text-xs tracking-[0.2em] text-[#4D94FF] uppercase">02 // FAILURE RESILIENCE</span>
              <span className="font-mono-code text-xs tracking-[0.16em] text-slate-400 uppercase">
                [ ARCHITECTURE MANIFESTO /// v5.3 ]
              </span>
            </div>

            <h2 className="font-display mt-6 text-[clamp(2.25rem,6vw,5.6rem)] leading-[0.92] font-bold tracking-[-0.03em] text-white uppercase">
              ZERO LOST ANSWERS.
              <br />
              <span className="text-slate-400">ZERO EXTRA TIME.</span>
            </h2>

            <p id="manifesto-copy" className="mt-10 max-w-4xl text-xl leading-relaxed font-medium sm:text-3xl sm:leading-[1.35]">
              {MANIFESTO_WORDS.map((word, idx) => (
                <span key={idx} className="intro-word mr-[0.28em] inline-block text-white/90">
                  {word}
                </span>
              ))}
            </p>

            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {RULES.map((rule) => (
                <Tilt3D
                  key={rule.code}
                  className="rounded-2xl border border-white/[0.09] bg-[#0A0E1A] p-7 transition-colors hover:border-[#0066FF]/45"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-code text-[11px] tracking-[0.18em] text-[#4D94FF]">{rule.code}</span>
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono-code text-[10px] text-emerald-400">
                      {rule.metric}
                    </span>
                  </div>
                  <h3 className="font-display mt-5 text-2xl font-bold text-white">{rule.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{rule.desc}</p>
                </Tilt3D>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 03: CAPABILITIES ACCORDION */}
        <section id="capabilities" className="border-t border-white/[0.08] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <span className="font-mono-code text-xs tracking-[0.2em] text-[#4D94FF] uppercase">03 // ENGINE MODULES</span>
            <h2 className="font-display mt-4 text-[clamp(2.25rem,5.5vw,5rem)] leading-[0.94] font-bold tracking-[-0.03em] text-white uppercase">
              WHAT IT ENFORCES.
            </h2>

            <div className="mt-12 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {CAPABILITIES.map((cap, idx) => {
                const isOpen = openCap === idx;
                return (
                  <div key={cap.num} className="py-6 sm:py-8">
                    <button
                      type="button"
                      onClick={() => setOpenCap(isOpen ? -1 : idx)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <span className="flex items-baseline gap-5">
                        <span className="font-mono-code text-sm text-[#4D94FF]">{cap.num}</span>
                        <span className="font-display text-2xl font-bold text-white sm:text-4xl">{cap.title}</span>
                      </span>
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono-code text-lg transition-transform duration-300",
                          isOpen ? "rotate-45 border-[#0066FF] bg-[#0066FF]/15 text-[#4D94FF]" : "text-slate-300",
                        )}
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mt-6 grid gap-8 pl-0 sm:pl-10 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                          <p className="text-base leading-relaxed text-slate-300">{cap.summary}</p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {cap.pills.map((p) => (
                              <span
                                key={p}
                                className="rounded-md border border-white/[0.1] bg-[#111728] px-2.5 py-1 font-mono-code text-[11px] text-slate-200"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
                          {cap.deliverables.map((d) => (
                            <li
                              key={d}
                              className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-[#0A0E1A] p-3.5 text-sm text-slate-300"
                            >
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4D94FF]" aria-hidden="true" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 04: INTERACTIVE 5.3 SIMULATOR & SYSTEM SHOWCASE */}
        <section id="systems" className="border-t border-white/[0.08] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="font-mono-code text-xs tracking-[0.2em] text-[#4D94FF] uppercase">04 // LIVE ARCHITECTURE</span>
                <h2 className="font-display mt-4 text-[clamp(2.25rem,5.5vw,5rem)] leading-[0.94] font-bold tracking-[-0.03em] text-white uppercase">
                  PROVEN MECHANICS.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSpecsOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 font-mono-code text-xs tracking-wider text-white uppercase hover:border-[#0066FF]/60 hover:bg-[#0066FF]/15"
              >
                <Terminal className="size-3.5 text-[#4D94FF]" aria-hidden="true" /> Inspect Specs & Database
              </button>
            </div>

            {/* Interactive Track 5.3 Simulator Card */}
            <Tilt3D
              maxTilt={3.5}
              className="mt-12 rounded-2xl border border-white/[0.1] bg-[#0A0E1A] p-5 shadow-2xl sm:p-8"
            >
              <div className="grid min-w-0 gap-8 lg:grid-cols-12">
                <div className="flex min-w-0 flex-col justify-between lg:col-span-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-md bg-[#0066FF]/15 px-2.5 py-1 font-mono-code text-[11px] font-semibold text-[#4D94FF]">
                        INTERACTIVE DEMO · TRACK 5.3
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono-code text-[11px]",
                          offline
                            ? "border-amber-500/35 bg-amber-500/15 text-amber-300"
                            : syncing
                              ? "border-[#0066FF]/40 bg-[#0066FF]/15 text-[#93C5FD]"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                        )}
                      >
                        {offline ? <WifiOff className="size-3" /> : <Wifi className="size-3" />}
                        {offline ? "OFFLINE" : syncing ? "RECONNECTING" : "ONLINE"}
                      </span>
                    </div>

                    <h3 className="font-display mt-5 text-2xl font-bold text-white sm:text-3xl">
                      Outbox & Revision Simulator
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">
                      Test our failure-resilient sync engine live: drop the simulated connection, change answers inside the browser outbox,
                      and restore the network to watch monotonic revisions flush cleanly.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={toggleNetwork}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-mono-code text-xs font-semibold uppercase transition-colors",
                        offline
                          ? "bg-emerald-400 text-black hover:bg-emerald-300"
                          : "border border-amber-400/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
                      )}
                    >
                      {offline ? <RefreshCw className="size-3.5" /> : <WifiOff className="size-3.5" />}
                      {offline ? "Restore Connection" : "Simulate Wi-Fi Drop"}
                    </button>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2.5 font-mono-code text-xs text-white uppercase hover:border-white/40"
                    >
                      Try Real Exam <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="min-w-0 space-y-4 lg:col-span-7">
                  <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#05070B] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                      <span className="font-mono-code text-[11px] text-slate-400">
                        ATTEMPT #WSEC-PRACTICE · OUTBOX: <strong className="text-white">{pendingCount}</strong>
                      </span>
                      <span className="font-mono-code text-[11px] text-[#4D94FF]">SERVER CLOCK AUTHORITATIVE</span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {(["Q1", "Q2", "Q3"] as const).map((q) => {
                        const state = answers[q]!;
                        return (
                          <div key={q} className="min-w-0 rounded-lg border border-white/[0.08] bg-[#0A0E1A] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono-code text-xs font-semibold text-white">{q}</span>
                              <span
                                className={cn(
                                  "truncate font-mono-code text-[10px]",
                                  state.synced ? "text-emerald-400" : "text-amber-300",
                                )}
                              >
                                {state.synced ? `rev ${state.rev} · synced` : `rev ${state.rev} · queued`}
                              </span>
                            </div>
                            <div className="mt-2.5 flex gap-1.5">
                              {["A", "B", "C"].map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => selectSimAnswer(q, opt)}
                                  className={cn(
                                    "flex-1 rounded border py-1 font-mono-code text-xs transition-colors",
                                    state.val === opt
                                      ? "border-[#0066FF] bg-[#0066FF] text-white"
                                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30",
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 min-w-0 space-y-1.5 border-t border-white/[0.08] pt-3">
                      {simLogs.map((log) => (
                        <div key={log.id} className="flex min-w-0 items-center justify-between gap-2 font-mono-code text-[11px]">
                          <span className="min-w-0 flex-1 break-words sm:truncate">
                            <span className="text-slate-500">{log.time}</span>{" "}
                            <span
                              className={
                                log.tone === "ok"
                                  ? "text-emerald-400"
                                  : log.tone === "warn"
                                    ? "text-amber-300"
                                    : "text-[#4D94FF]"
                              }
                            >
                              [{log.tag}]
                            </span>{" "}
                            <span className="text-slate-300">{log.detail}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Tilt3D>

            {/* Secondary Architecture Cards */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <Tilt3D className="rounded-2xl border border-white/[0.09] bg-[#0A0E1A] p-7">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-mono-code text-xs text-[#4D94FF]">
                    <Activity className="size-4" aria-hidden="true" /> LIVE TELEMETRY
                  </span>
                  <span className="font-mono-code text-[11px] text-slate-400">EXAMINER VIEW</span>
                </div>
                <h3 className="font-display mt-4 text-2xl font-bold text-white">Separated Disruption & Integrity Logs</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  Examiner monitoring separates network interruptions (NETWORK_LOSS, RECONNECTED, SYNC_FAILED) from behavioral signals with
                  explicit non-misconduct disclaimers.
                </p>
                <Link
                  href="/login"
                  className="mt-5 inline-flex items-center gap-1.5 font-mono-code text-xs text-[#4D94FF] uppercase hover:underline"
                >
                  Open Examiner Dashboard <ArrowUpRight className="size-3.5" />
                </Link>
              </Tilt3D>

              <Tilt3D className="rounded-2xl border border-white/[0.09] bg-[#0A0E1A] p-7">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-mono-code text-xs text-emerald-400">
                    <FileCheck2 className="size-4" aria-hidden="true" /> QR CERTIFICATE SEAL
                  </span>
                  <span className="font-mono-code text-[11px] text-slate-400">PUBLIC /VERIFY</span>
                </div>
                <h3 className="font-display mt-4 text-2xl font-bold text-white">Zero-PII Public Result Verification</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                  Every published PDF report embeds a QR verification code checked against live database issuance records — confirming valid,
                  revoked, or invalid states without leaking personal scores.
                </p>
                <Link
                  href="/verify"
                  className="mt-5 inline-flex items-center gap-1.5 font-mono-code text-xs text-emerald-400 uppercase hover:underline"
                >
                  Verify a Result Code <ArrowUpRight className="size-3.5" />
                </Link>
              </Tilt3D>
            </div>
          </div>
        </section>

        {/* SECTION 05: PIPELINE + STACK MARQUEE + FOOTER */}
        <section id="pipeline" className="border-t border-white/[0.08] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <span className="font-mono-code text-xs tracking-[0.2em] text-[#4D94FF] uppercase">05 // WORKFLOW & STACK</span>
            <h2 className="font-display mt-4 text-[clamp(2.25rem,5.5vw,5rem)] leading-[0.94] font-bold tracking-[-0.03em] text-white uppercase">
              HOW AN EXAM SHIPS.
            </h2>

            <div className="mt-10 grid gap-3 sm:grid-cols-4">
              {PIPELINE_STEPS.map((st, idx) => (
                <button
                  key={st.phase}
                  type="button"
                  onClick={() => setActivePhase(idx)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    activePhase === idx
                      ? "border-[#0066FF] bg-[#0066FF]/12 shadow-[0_0_24px_rgba(0,102,255,0.2)]"
                      : "border-white/[0.08] bg-[#0A0E1A] hover:border-white/25",
                  )}
                >
                  <span className="font-mono-code text-[11px] text-[#4D94FF]">{st.phase}</span>
                  <span className="font-display mt-1 block text-xl font-bold text-white">{st.title}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.09] bg-[#0A0E1A] p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-code text-xs tracking-widest text-emerald-400 uppercase">
                  {PIPELINE_STEPS[activePhase]!.window}
                </span>
                <span className="font-mono-code text-xs text-slate-400">ROLE-ENFORCED PIPELINE</span>
              </div>
              <h3 className="font-display mt-3 text-3xl font-bold text-white">{PIPELINE_STEPS[activePhase]!.title}</h3>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-300">{PIPELINE_STEPS[activePhase]!.desc}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PIPELINE_STEPS[activePhase]!.points.map((pt) => (
                  <div key={pt} className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-[#05070B] p-3.5 text-sm text-slate-300">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-[#4D94FF]" aria-hidden="true" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Infinite Tech Stack Marquee */}
          <div className="mt-20 border-y border-white/[0.08] bg-[#0A0E1A]/60 py-6">
            <div className="mx-auto mb-3 max-w-7xl px-5 sm:px-8 lg:px-12">
              <span className="font-mono-code text-[11px] tracking-[0.2em] text-slate-400 uppercase">VERIFIED PRODUCTION STACK</span>
            </div>
            <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
              <div className="animate-marquee gap-3">
                {[...TECH_STACK, ...TECH_STACK].map((tech, idx) => (
                  <span
                    key={`${tech}-${idx}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/[0.1] bg-[#05070B] px-4 py-2 font-mono-code text-xs text-slate-200"
                  >
                    <Cpu className="size-3 text-[#4D94FF]" aria-hidden="true" />
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#05070B] pt-16 pb-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-6">
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">READY TO TEST THE ENGINE?</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                Sign in with instant demo credentials for Admin, Examiner, or Candidate roles — or verify an issued certificate directly.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <MagneticWrap>
                  <Link
                    href="/login"
                    className="glow-cta inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-mono-code text-xs font-semibold text-black uppercase hover:bg-[#0066FF] hover:text-white"
                  >
                    Sign In to Demo <ArrowUpRight className="size-4" />
                  </Link>
                </MagneticWrap>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 font-mono-code text-xs text-white uppercase hover:border-white/40"
                >
                  Verify Report
                </Link>
              </div>
            </div>

            <div className="space-y-2 md:col-span-3">
              <p className="font-mono-code text-[11px] tracking-[0.2em] text-slate-400 uppercase">SYSTEM DIRECTORY</p>
              <ul className="space-y-2 text-sm text-slate-300">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => scrollToSection(s.id)} className="hover:text-[#4D94FF]">
                      {s.num} · {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 md:col-span-3">
              <p className="font-mono-code text-[11px] tracking-[0.2em] text-slate-400 uppercase">TELEMETRY STATUS</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 font-mono-code text-xs text-emerald-400">
                <span className="size-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" /> All Systems Operational
              </span>
              <p className="text-xs text-slate-400">TechnoVerse 5.0 Web-e-Thon · Innovation Track 5.3</p>
              <button
                type="button"
                onClick={() => scrollToSection("hero")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 font-mono-code text-[11px] text-white uppercase hover:border-[#0066FF]"
              >
                <ArrowUp className="size-3.5" aria-hidden="true" /> Top
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Section Status HUD */}
      <aside
        aria-label="Section status"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#05070B]/80 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2.5 sm:px-8 lg:px-12">
          <span className="font-mono-code text-[11px] tracking-wider text-slate-200">
            {SECTIONS[activeSection]!.num} / 05 <span className="text-[#4D94FF]">•</span> {SECTIONS[activeSection]!.label}
          </span>

          <div className="hidden max-w-md flex-1 items-center gap-3 md:flex">
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#0066FF] transition-all duration-300"
                style={{ width: `${((activeSection + 1) / SECTIONS.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              {SECTIONS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  aria-label={`Jump to ${s.label}`}
                  className={cn(
                    "size-2 rotate-45 transition-all",
                    idx === activeSection ? "scale-125 bg-[#0066FF] shadow-[0_0_8px_#0066FF]" : "bg-white/25 hover:bg-white/60",
                  )}
                />
              ))}
            </div>
          </div>

          <span className="inline-flex items-center gap-2 font-mono-code text-[11px] text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            SYS.OPERATIONAL <span className="hidden text-slate-500 sm:inline">{"/// 5.3"}</span>
          </span>
        </div>
      </aside>

      {/* Specs & Database Architecture Modal */}
      {specsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="specs-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setSpecsOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0A0E1A] p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono-code text-[11px] tracking-[0.2em] text-[#4D94FF] uppercase">ARCHITECTURE SPECIFICATION</span>
                <h3 id="specs-title" className="font-display mt-1 text-2xl font-bold text-white">
                  CodeKaizen Monolith · 14 Postgres Tables
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSpecsOpen(false)}
                aria-label="Close specifications"
                className="rounded-full border border-white/15 p-2 text-slate-300 hover:border-white/40 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-[#05070B] p-4">
                <p className="flex items-center gap-2 font-mono-code text-xs text-[#4D94FF]">
                  <Database className="size-3.5" /> DATA INTEGRITY
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                  <li>• Partial unique index: 1 open attempt / candidate / exam</li>
                  <li>• Idempotent upsert: WHERE revision &gt; stored</li>
                  <li>• Conditional submit: WHERE status = IN_PROGRESS</li>
                  <li>• Frozen JSON question_snapshot per attempt</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#05070B] p-4">
                <p className="flex items-center gap-2 font-mono-code text-xs text-emerald-400">
                  <ShieldCheck className="size-3.5" /> SECURITY BOUNDARIES
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                  <li>• HS256 HTTP-only cookie + DB session_version check</li>
                  <li>• 404 isolation across unauthorized examiners</li>
                  <li>• Answer keys stripped via toCandidateQuestions</li>
                  <li>• 3s grace deadline enforcement + late rejection log</li>
                </ul>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#05070B] p-4">
              <p className="flex items-center gap-2 font-mono-code text-xs text-slate-400">
                <LockKeyhole className="size-3.5 text-[#4D94FF]" /> CORE SCHEMA TABLES
              </p>
              <p className="mt-2 font-mono-code text-xs leading-relaxed text-slate-300">
                users · exams · questions · exam_questions · enrollments · attempts · answers · results · announcements · incidents ·
                disputes · user_preferences · scratchpads · audit_logs
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
