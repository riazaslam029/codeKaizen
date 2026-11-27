"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, ReferenceLine, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

/** Daily platform activity (audit events + real attempts started). */
export function ActivityChart({ data }: { data: { day: string; events: number; attempts: number }[] }) {
  const config = {
    events: { label: "Platform events", color: "var(--chart-1)" },
    attempts: { label: "Attempts started", color: "var(--chart-4)" },
  } satisfies ChartConfig;
  const total = data.reduce((a, d) => ({ e: a.e + d.events, t: a.t + d.attempts }), { e: 0, t: 0 });
  return (
    <figure>
      <ChartContainer config={config} className="h-64 w-full">
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
          <defs>
            <linearGradient id="fill-events" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-events)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--color-events)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fill-attempts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-attempts)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--color-attempts)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="events" type="monotone" stroke="var(--color-events)" strokeWidth={2} fill="url(#fill-events)" />
          <Area dataKey="attempts" type="monotone" stroke="var(--color-attempts)" strokeWidth={2} fill="url(#fill-attempts)" />
        </AreaChart>
      </ChartContainer>
      <figcaption className="sr-only">
        Over the last {data.length} days: {total.e} platform events and {total.t} attempts started.
      </figcaption>
    </figure>
  );
}

/** Candidate's own published percentages over time, with the pass mark of each exam as hover detail. */
export function PerformanceTrendChart({ data }: { data: { label: string; percentage: number; pass: number }[] }) {
  const config = { percentage: { label: "Score %", color: "var(--chart-1)" } } satisfies ChartConfig;
  const avg = data.length ? Math.round(data.reduce((a, d) => a + d.percentage, 0) / data.length) : 0;
  return (
    <figure>
      <ChartContainer config={config} className="h-56 w-full">
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
          <defs>
            <linearGradient id="fill-perf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-percentage)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-percentage)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} unit="%" />
          <ReferenceLine y={avg} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area dataKey="percentage" type="monotone" stroke="var(--color-percentage)" strokeWidth={2} fill="url(#fill-perf)" dot={{ r: 3 }} />
        </AreaChart>
      </ChartContainer>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {data.map((d) => `${d.label}: ${d.percentage}%`).join(" · ")} — dashed line is your average ({avg}%).
      </figcaption>
    </figure>
  );
}

/** Score distribution in 10-point buckets. */
export function DistributionChart({ data }: { data: { range: string; count: number }[] }) {
  const config = { count: { label: "Candidates", color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="range" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Pass vs not passed. */
export function PassChart({ passed, failed }: { passed: number; failed: number }) {
  const data = [
    { key: "passed", value: passed, fill: "var(--color-passed)" },
    { key: "failed", value: failed, fill: "var(--color-failed)" },
  ];
  const config = {
    passed: { label: "Passed", color: "var(--chart-5)" },
    failed: { label: "Not passed", color: "var(--chart-3)" },
    value: { label: "Candidates" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="mx-auto h-64 w-full max-w-xs">
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={58} outerRadius={90} strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
      </PieChart>
    </ChartContainer>
  );
}

/** Correct-response % per question (Q1…Qn). */
export function QuestionRatesChart({ data }: { data: { label: string; correct: number; skipped: number }[] }) {
  const config = {
    correct: { label: "Correct %", color: "var(--chart-1)" },
    skipped: { label: "Skipped %", color: "var(--chart-4)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} unit="%" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="correct" fill="var(--color-correct)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="skipped" fill="var(--color-skipped)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Radial score gauge (percentage) with the pass mark in the caption. */
export function ScoreGauge({ percentage, passed }: { percentage: number; passed: boolean }) {
  const config = { score: { label: "Score", color: passed ? "var(--success)" : "var(--destructive)" } } satisfies ChartConfig;
  const data = [{ name: "score", value: Math.max(0, Math.min(100, percentage)), fill: "var(--color-score)" }];
  return (
    <ChartContainer config={config} className="relative mx-auto aspect-square h-44" role="img" aria-label={`Score ${percentage.toFixed(1)} percent`}>
      <RadialBarChart data={data} startAngle={90} endAngle={-270} innerRadius="78%" outerRadius="100%">
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="value" background={{ fill: "var(--muted)" }} cornerRadius={12} isAnimationActive />
      </RadialBarChart>
    </ChartContainer>
  );
}

/** Per-topic percentage bars (horizontal). */
export function TopicChart({ data }: { data: { topic: string; percentage: number }[] }) {
  const config = { percentage: { label: "Score %", color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="w-full" style={{ height: Math.max(140, data.length * 42) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }} accessibilityLayer>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="topic" width={110} tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="percentage" fill="var(--color-percentage)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Assigned difficulty vs observed accuracy (average correct %). */
export function DifficultyAccuracyChart({ data }: { data: { difficulty: string; accuracy: number; questions: number }[] }) {
  const config = { accuracy: { label: "Observed correct %", color: "var(--chart-2)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="difficulty" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="accuracy" fill="var(--color-accuracy)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
