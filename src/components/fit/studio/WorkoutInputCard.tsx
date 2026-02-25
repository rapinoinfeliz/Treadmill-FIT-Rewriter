import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DurationMismatchWarning,
  BuilderRow,
  BuilderSpeedDisplay,
} from "@/components/fit/studio/types";
import type { DurationUnit, WorkoutSegment } from "@/lib/fit/prescription";
import { cn, formatDuration, formatKm } from "@/lib/utils";

type WorkoutInputCardProps = {
  mode: "builder" | "notation";
  onModeChange: (mode: "builder" | "notation") => void;
  speedDisplay: BuilderSpeedDisplay;
  onSpeedDisplayChange: (mode: BuilderSpeedDisplay) => void;
  rows: BuilderRow[];
  onRowNameChange: (index: number, value: string) => void;
  onRowDurationChange: (index: number, value: string) => void;
  onRowDurationUnitChange: (index: number, value: DurationUnit) => void;
  onRowSpeedChange: (index: number, value: string) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  notation: string;
  onNotationChange: (value: string) => void;
  segments: WorkoutSegment[];
  parsedError: string | null;
  workoutDurationSeconds: number;
  workoutDistanceKm: number;
  durationWarning: DurationMismatchWarning | null;
};

export function WorkoutInputCard({
  mode,
  onModeChange,
  speedDisplay,
  onSpeedDisplayChange,
  rows,
  onRowNameChange,
  onRowDurationChange,
  onRowDurationUnitChange,
  onRowSpeedChange,
  onRemoveRow,
  onAddRow,
  notation,
  onNotationChange,
  segments,
  parsedError,
  workoutDurationSeconds,
  workoutDistanceKm,
  durationWarning,
}: WorkoutInputCardProps) {
  return (
    <div className="panel p-5 md:p-6" id="parser">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">2. Real Workout Input</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "builder" ? "default" : "secondary"}
            size="sm"
            onClick={() => onModeChange("builder")}
          >
            Visual Builder
          </Button>
          <Button
            variant={mode === "notation" ? "default" : "secondary"}
            size="sm"
            onClick={() => onModeChange("notation")}
          >
            Text Notation
          </Button>
        </div>
      </div>

      {mode === "builder" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Input unit</span>
            <Button
              type="button"
              size="sm"
              variant={speedDisplay === "kmh" ? "default" : "secondary"}
              onClick={() => onSpeedDisplayChange("kmh")}
              className="h-7 px-2.5 text-[11px]"
            >
              km/h
            </Button>
            <Button
              type="button"
              size="sm"
              variant={speedDisplay === "pace" ? "default" : "secondary"}
              onClick={() => onSpeedDisplayChange("pace")}
              className="h-7 px-2.5 text-[11px]"
            >
              min/km
            </Button>
          </div>

          {rows.map((row, index) => (
            <div key={row.id} className="panel-soft grid grid-cols-1 gap-3 p-3 md:grid-cols-12">
              <div className="flex items-center justify-between md:col-span-12">
                <div className="rounded-md bg-black/20 px-2 py-1 text-xs text-muted-foreground">
                  Step {index + 1}
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemoveRow(index)} title="Remove step">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="md:col-span-5">
                <label className="mb-1 block text-xs text-muted-foreground">Name</label>
                <Input
                  type="text"
                  value={row.name}
                  placeholder={`Step ${index + 1}`}
                  onChange={(event) => onRowNameChange(index, event.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:col-span-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Duration</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={row.duration}
                    onChange={(event) => onRowDurationChange(index, event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Unit</label>
                  <select
                    className="glass-input flex h-9 w-full rounded-md border px-2 text-sm"
                    value={row.unit}
                    onChange={(event) => onRowDurationUnitChange(index, event.target.value as DurationUnit)}
                  >
                    <option value="s">seconds</option>
                    <option value="m">minutes</option>
                    <option value="h">hours</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs text-muted-foreground">
                  {speedDisplay === "kmh" ? "Speed (km/h)" : "Pace (min/km)"}
                </label>
                <Input
                  type={speedDisplay === "kmh" ? "number" : "text"}
                  step={speedDisplay === "kmh" ? "0.1" : undefined}
                  value={speedDisplay === "kmh" ? row.speedKmh : row.pace}
                  placeholder={speedDisplay === "kmh" ? "10.0" : "4:30"}
                  onChange={(event) => onRowSpeedChange(index, event.target.value)}
                />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={onAddRow}>
            <Plus className="mr-1 h-4 w-4" /> Add step
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={notation}
            onChange={(event) => onNotationChange(event.target.value)}
            className="glass-input min-h-[150px] w-full resize-y rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="Example: 3x(2m@14km/h{Fast},1m@8km/h{Recovery}), 4x(45s@3:40/km{Rep},15s@8km/h{Easy})"
          />
          <p className="text-xs text-muted-foreground">
            Supported: 10m@10km/h, 45s@5m/s, 45s@3:40/km, 3x(2m@14,1m@8), optional names: 45s@16.3km/h{"{Step 43}"}
          </p>
        </div>
      )}

      <div className="panel-soft mt-4 p-3 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">steps: {segments.length}</Badge>
          <Badge variant="outline">duration: {formatDuration(workoutDurationSeconds)}</Badge>
          <Badge variant="outline">planned distance: {formatKm(workoutDistanceKm)}</Badge>
        </div>

        {parsedError ? (
          <p className="text-sm text-red-300">{parsedError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {segments.slice(0, 4).map((segment) => formatSegmentLabel(segment)).join(" | ")}
            {segments.length > 4 ? " ..." : ""}
          </p>
        )}
      </div>

      {durationWarning ? (
        <div
          className={cn(
            "mt-3 rounded-lg border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
          )}
        >
          Workout duration ({formatDuration(durationWarning.workoutDurationSeconds)}) does not match FIT duration (
          {formatDuration(durationWarning.fitDurationSeconds)}). Difference:{" "}
          {formatDuration(durationWarning.deltaSeconds)}.
        </div>
      ) : null}
    </div>
  );
}

function formatSegmentLabel(segment: WorkoutSegment): string {
  const seconds = Math.round(segment.durationSeconds);
  const mins = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const durationText =
    mins > 0 && remainingSeconds > 0
      ? `${mins}m ${remainingSeconds}s`
      : mins > 0
        ? `${mins}m`
        : `${remainingSeconds}s`;

  const base = `${durationText} @ ${segment.speedKmh.toFixed(1)} km/h`;
  return segment.name ? `${segment.name}: ${base}` : base;
}
