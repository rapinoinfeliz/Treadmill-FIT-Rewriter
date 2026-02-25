"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { SpeedPreviewPoint } from "@/lib/fit/correction";
import { cn, formatDuration, formatPace, formatSpeed } from "@/lib/utils";

type SpeedComparisonChartProps = {
  points: SpeedPreviewPoint[];
  minimal?: boolean;
};

type ChartModel = {
  hasData: boolean;
  correctedPolyline: string;
  correctedAreaPath: string;
  originalPolyline: string;
  gridY: number[];
  gridX: number[];
  xTicks: Array<{ x: number; label: string }>;
  yTicks: Array<{ y: number; label: string }>;
  width: number;
  height: number;
  padding: number;
  maxTime: number;
  x: (elapsedSeconds: number) => number;
  y: (speedKmh: number) => number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function SpeedComparisonChart({ points, minimal = false }: SpeedComparisonChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (points.length === 0) {
      return {
        hasData: false,
        correctedPolyline: "",
        correctedAreaPath: "",
        originalPolyline: "",
        gridY: [] as number[],
        gridX: [] as number[],
        xTicks: [] as Array<{ x: number; label: string }>,
        yTicks: [] as Array<{ y: number; label: string }>,
        width: 0,
        height: 0,
        padding: 0,
        maxTime: 0,
        x: () => 0,
        y: () => 0,
      } satisfies ChartModel;
    }

    const width = 1100;
    const height = minimal ? 310 : 360;
    const padding = minimal ? 38 : 42;

    const maxTime = Math.max(points[points.length - 1].elapsedSeconds, 1);
    const maxSpeed = Math.max(
      ...points.map((point) => Math.max(point.originalSpeedKmh, point.correctedSpeedKmh)),
      1
    );

    const x = (elapsedSeconds: number) => {
      return padding + (elapsedSeconds / maxTime) * (width - padding * 2);
    };

    const y = (speedKmh: number) => {
      return height - padding - (speedKmh / maxSpeed) * (height - padding * 2);
    };

    const correctedPolyline = points
      .map((point) => `${x(point.elapsedSeconds).toFixed(2)},${y(point.correctedSpeedKmh).toFixed(2)}`)
      .join(" ");

    const originalPolyline = points
      .map((point) => `${x(point.elapsedSeconds).toFixed(2)},${y(point.originalSpeedKmh).toFixed(2)}`)
      .join(" ");

    const yTickCount = minimal ? 5 : 6;
    const yTicks = Array.from({ length: yTickCount }, (_, index) => {
      const ratio = index / (yTickCount - 1);
      const speed = maxSpeed * (1 - ratio);
      return {
        y: y(speed),
        label: `${speed.toFixed(1)} km/h`,
      };
    });

    const xTickCount = minimal ? 5 : 7;
    const xTicks = Array.from({ length: xTickCount }, (_, index) => {
      const ratio = index / (xTickCount - 1);
      const elapsed = maxTime * ratio;
      const minutes = Math.floor(elapsed / 60);
      const seconds = Math.round(elapsed % 60)
        .toString()
        .padStart(2, "0");

      return {
        x: x(elapsed),
        label: `${minutes}:${seconds}`,
      };
    });

    const gridY = yTicks.map((item) => item.y);
    const gridX = xTicks.map((item) => item.x);
    const baseY = height - padding;
    const firstX = x(points[0].elapsedSeconds);
    const lastX = x(points[points.length - 1].elapsedSeconds);
    const correctedAreaPath = `M ${firstX.toFixed(2)} ${baseY.toFixed(2)} L ${correctedPolyline} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} Z`;

    return {
      hasData: true,
      correctedPolyline,
      correctedAreaPath,
      originalPolyline,
      gridY,
      gridX,
      xTicks,
      yTicks,
      width,
      height,
      padding,
      maxTime,
      x,
      y,
    } satisfies ChartModel;
  }, [minimal, points]);

  if (!chart.hasData) {
    return (
      <div className="panel flex h-[320px] items-center justify-center p-6">
        <div className="empty-state max-w-sm">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Speed profile preview pending</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Run the correction to compare the original and rewritten speed traces.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const safeHoverIndex = hoverIndex !== null && hoverIndex < points.length ? hoverIndex : null;
  const activePoint = safeHoverIndex !== null ? points[safeHoverIndex] : null;
  const hoverX = activePoint ? chart.x(activePoint.elapsedSeconds) : null;

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * chart.width;
    const clampedX = clamp(relativeX, chart.padding, chart.width - chart.padding);
    const ratio = (clampedX - chart.padding) / (chart.width - chart.padding * 2);
    const targetElapsed = ratio * chart.maxTime;

    let closest = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < points.length; index += 1) {
      const distance = Math.abs(points[index].elapsedSeconds - targetElapsed);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = index;
      }
    }

    setHoverIndex(closest);
  };

  const tooltipLeftPercent = activePoint
    ? clamp((chart.x(activePoint.elapsedSeconds) / chart.width) * 100, 13, 87)
    : 50;

  return (
    <div className="panel p-4">
      {!minimal ? (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Original profile
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Corrected profile
          </span>
        </div>
      ) : null}

      <div className="relative">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[320px] w-full"
          role="img"
          aria-label="Speed comparison chart with original and corrected profiles"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.015)" />
            </linearGradient>
            <linearGradient id="correctedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(251,191,36,0.45)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0.03)" />
            </linearGradient>
          </defs>

          <rect
            x={chart.padding}
            y={chart.padding}
            width={chart.width - chart.padding * 2}
            height={chart.height - chart.padding * 2}
            fill="url(#chartBg)"
            rx={8}
          />

          {chart.gridY.map((gridLineY) => (
            <line
              key={`grid-y-${gridLineY}`}
              x1={chart.padding}
              x2={chart.width - chart.padding}
              y1={gridLineY}
              y2={gridLineY}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          ))}

          {chart.gridX.map((gridLineX) => (
            <line
              key={`grid-x-${gridLineX}`}
              x1={gridLineX}
              x2={gridLineX}
              y1={chart.padding}
              y2={chart.height - chart.padding}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}

          <line
            x1={chart.padding}
            x2={chart.padding}
            y1={chart.padding}
            y2={chart.height - chart.padding}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.2}
          />

          <line
            x1={chart.padding}
            x2={chart.width - chart.padding}
            y1={chart.height - chart.padding}
            y2={chart.height - chart.padding}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.2}
          />

          <path d={chart.correctedAreaPath} fill="url(#correctedFill)" />

          <polyline
            fill="none"
            stroke="rgba(161,161,170,0.9)"
            strokeWidth={2.1}
            points={chart.originalPolyline}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <polyline
            fill="none"
            stroke="oklch(0.79 0.17 72)"
            strokeWidth={2.8}
            points={chart.correctedPolyline}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {hoverX !== null && activePoint ? (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={chart.padding}
                y2={chart.height - chart.padding}
                stroke="rgba(251,191,36,0.6)"
                strokeWidth={1.3}
                strokeDasharray="5 5"
              />
              <circle cx={hoverX} cy={chart.y(activePoint.originalSpeedKmh)} r={4} fill="rgba(161,161,170,0.95)" />
              <circle cx={hoverX} cy={chart.y(activePoint.correctedSpeedKmh)} r={5} fill="oklch(0.79 0.17 72)" />
            </>
          ) : null}

          {chart.yTicks.map((tick) => (
            <text key={`y-${tick.y}`} x={8} y={tick.y + 4} fill="rgba(255,255,255,0.58)" fontSize={11}>
              {tick.label}
            </text>
          ))}

          {chart.xTicks.map((tick) => (
            <text
              key={`x-${tick.x}`}
              x={tick.x}
              y={chart.height - 10}
              fill="rgba(255,255,255,0.58)"
              fontSize={11}
              textAnchor="middle"
            >
              {tick.label}
            </text>
          ))}
        </svg>

        {activePoint ? (
          <div
            className={cn(
              "pointer-events-none absolute top-3 rounded-md border border-border/85 bg-background/95 px-3 py-2 shadow-lg backdrop-blur",
              "transition-opacity duration-150"
            )}
            style={{ left: `${tooltipLeftPercent}%`, transform: "translateX(-50%)" }}
          >
            <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {formatDuration(activePoint.elapsedSeconds)}
            </p>
            <p className="text-xs text-zinc-300">
              Original: {formatSpeed(activePoint.originalSpeedKmh)} ({formatPace(activePoint.originalSpeedKmh)})
            </p>
            <p className="text-xs text-primary">
              Corrected: {formatSpeed(activePoint.correctedSpeedKmh)} ({formatPace(activePoint.correctedSpeedKmh)})
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
