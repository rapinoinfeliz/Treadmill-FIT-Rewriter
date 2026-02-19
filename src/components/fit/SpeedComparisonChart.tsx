"use client";

import { useMemo } from "react";
import { SpeedPreviewPoint } from "@/lib/fit/correction";

type SpeedComparisonChartProps = {
  points: SpeedPreviewPoint[];
};

export function SpeedComparisonChart({ points }: SpeedComparisonChartProps) {
  const chart = useMemo(() => {
    if (points.length === 0) {
      return {
        hasData: false,
        correctedPolyline: "",
        originalPolyline: "",
        gridY: [] as number[],
        xTicks: [] as Array<{ x: number; label: string }>,
        yTicks: [] as Array<{ y: number; label: string }>,
        width: 0,
        height: 0,
        padding: 0,
      };
    }

    const width = 1100;
    const height = 360;
    const padding = 42;

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

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const speed = maxSpeed * (1 - ratio);
      return {
        y: y(speed),
        label: `${speed.toFixed(1)} km/h`,
      };
    });

    const xTicks = Array.from({ length: 6 }, (_, index) => {
      const ratio = index / 5;
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

    return {
      hasData: true,
      correctedPolyline,
      originalPolyline,
      gridY,
      xTicks,
      yTicks,
      width,
      height,
      padding,
    };
  }, [points]);

  if (!chart.hasData) {
    return (
      <div className="panel flex h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
        Run the correction to preview original vs corrected speed profile.
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Original profile
        </span>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Corrected profile
        </span>
      </div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-[320px] w-full"
        role="img"
        aria-label="Speed comparison chart with original and corrected profiles"
      >
        <defs>
          <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
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
            key={`grid-${gridLineY}`}
            x1={chart.padding}
            x2={chart.width - chart.padding}
            y1={gridLineY}
            y2={gridLineY}
            stroke="rgba(255,255,255,0.08)"
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

        <polyline
          fill="none"
          stroke="rgba(161,161,170,0.9)"
          strokeWidth={2}
          points={chart.originalPolyline}
        />

        <polyline
          fill="none"
          stroke="oklch(0.79 0.17 72)"
          strokeWidth={2.6}
          points={chart.correctedPolyline}
        />

        {chart.yTicks.map((tick) => (
          <text key={`y-${tick.y}`} x={8} y={tick.y + 4} fill="rgba(255,255,255,0.6)" fontSize={11}>
            {tick.label}
          </text>
        ))}

        {chart.xTicks.map((tick) => (
          <text
            key={`x-${tick.x}`}
            x={tick.x}
            y={chart.height - 10}
            fill="rgba(255,255,255,0.6)"
            fontSize={11}
            textAnchor="middle"
          >
            {tick.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
