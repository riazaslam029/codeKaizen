"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

/** Daily platform activity (audit events + real attempts started). */
export function ActivityChart({ data }: { data: { day: string; events: number; attempts: number }[] }) {
  const config = {
    events: { label: "Platform events", color: "var(--chart-1)" },
    attempts: { label: "Attempts started", color: "var(--chart-5)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="events" type="monotone" stroke="var(--color-events)" strokeWidth={2} dot={false} />
        <Line dataKey="attempts" type="monotone" stroke="var(--color-attempts)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
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
