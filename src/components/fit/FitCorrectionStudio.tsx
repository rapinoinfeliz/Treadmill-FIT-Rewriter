"use client";

import { useMemo, useRef, useState } from "react";
import { Download, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { SpeedComparisonChart } from "@/components/fit/SpeedComparisonChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CorrectionSummary, SpeedPreviewPoint } from "@/lib/fit/correction";
import {
  DurationUnit,
  formatSegmentLabel,
  normalizeBuilderSegments,
  parseIntervalsNotation,
  totalDistanceKm,
  totalDurationSeconds,
  WorkoutSegment,
} from "@/lib/fit/prescription";
import { formatDuration, formatKm, formatSpeed } from "@/lib/utils";

type BuilderRow = {
  duration: string;
  unit: DurationUnit;
  speedKmh: string;
};

type ApiSuccess = {
  fileName: string;
  correctedFitBase64: string;
  points: SpeedPreviewPoint[];
  summary: CorrectionSummary;
  segments: WorkoutSegment[];
};

const makeDefaultRow = (): BuilderRow => ({
  duration: "10",
  unit: "m",
  speedKmh: "10",
});

export function FitCorrectionStudio() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"builder" | "notation">("builder");
  const [rows, setRows] = useState<BuilderRow[]>([makeDefaultRow()]);
  const [notation, setNotation] = useState("10m@10km/h, 5m@12km/h, 5m@9km/h");
  const [result, setResult] = useState<ApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const parsed = useMemo(() => {
    try {
      if (mode === "builder") {
        const payload = rows.map((row) => ({
          duration: Number(row.duration),
          unit: row.unit,
          speedKmh: Number(row.speedKmh),
        }));

        const segments = normalizeBuilderSegments(payload);
        return {
          segments,
          error: null,
        };
      }

      const segments = parseIntervalsNotation(notation);
      return {
        segments,
        error: null,
      };
    } catch (parseError) {
      return {
        segments: [] as WorkoutSegment[],
        error: parseError instanceof Error ? parseError.message : "Could not parse workout input.",
      };
    }
  }, [mode, rows, notation]);

  const workoutDuration = totalDurationSeconds(parsed.segments);
  const workoutDistance = totalDistanceKm(parsed.segments);

  const updateRow = (index: number, patch: Partial<BuilderRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return { ...row, ...patch };
      })
    );
  };

  const removeRow = (index: number) => {
    setRows((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const addRow = () => {
    setRows((current) => [...current, makeDefaultRow()]);
  };

  const processFit = async () => {
    setError(null);

    if (!file) {
      setError("Select a .fit file to continue.");
      return;
    }

    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setIsProcessing(true);

    try {
      const builderPayload = rows.map((row) => ({
        duration: Number(row.duration),
        unit: row.unit,
        speedKmh: Number(row.speedKmh),
      }));

      const formData = new FormData();
      formData.append("fitFile", file);
      formData.append("mode", mode);
      formData.append("notation", notation);
      formData.append("builderSegments", JSON.stringify(builderPayload));

      const response = await fetch("/api/fit/correct", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ApiSuccess | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Failed to process FIT file.");
      }

      setResult(payload as ApiSuccess);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error ? requestError.message : "Unexpected failure while processing the file."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCorrectedFile = () => {
    if (!result) return;

    const binary = atob(result.correctedFitBase64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="enter-rise space-y-6" id="studio">
      <section className="panel panel-hero grid-fine relative overflow-hidden p-6 md:p-8">
        <div className="absolute -right-20 -top-24 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-primary/90">Treadmill FIT Rewriter</p>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
              Rewrite treadmill speed and distance without losing sensor data
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              Upload your activity, describe the real workout, preview original vs corrected speed profile, and
              export a Strava-ready FIT file with workout linking.
            </p>
          </div>

          <Badge variant="secondary" className="font-mono text-[11px] uppercase tracking-[0.14em]">
            decode / rewrite / encode
          </Badge>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <section className="space-y-6">
          <div className="panel p-5 md:p-6">
            <h3 className="mb-3 text-base font-semibold">1. FIT File Upload</h3>

            <label className="panel-soft flex cursor-pointer flex-col gap-3 border border-dashed border-border/75 p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".fit"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                }}
              />

              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" /> Choose a .fit file
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select File
                </Button>
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "No file selected"}
                </span>
              </div>

              <span className="text-xs text-muted-foreground">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Accepted format: .fit"}
              </span>
            </label>
          </div>

          <div className="panel p-5 md:p-6" id="parser">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">2. Real Workout Input</h3>
              <div className="flex gap-2">
                <Button
                  variant={mode === "builder" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setMode("builder")}
                >
                  Visual Builder
                </Button>
                <Button
                  variant={mode === "notation" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setMode("notation")}
                >
                  Text Notation
                </Button>
              </div>
            </div>

            {mode === "builder" ? (
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div key={`row-${index}`} className="panel-soft flex flex-wrap items-end gap-3 p-3">
                    <div className="min-w-[110px] shrink-0 rounded-md bg-black/20 px-2 py-1 text-xs text-muted-foreground">
                      Step {index + 1}
                    </div>

                    <div className="min-w-[120px] flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">Duration</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={row.duration}
                        onChange={(event) => updateRow(index, { duration: event.target.value })}
                      />
                    </div>

                    <div className="w-[120px]">
                      <label className="mb-1 block text-xs text-muted-foreground">Unit</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background/70 px-2 text-sm"
                        value={row.unit}
                        onChange={(event) =>
                          updateRow(index, {
                            unit: event.target.value as DurationUnit,
                          })
                        }
                      >
                        <option value="s">seconds</option>
                        <option value="m">minutes</option>
                        <option value="h">hours</option>
                      </select>
                    </div>

                    <div className="min-w-[140px] flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">Speed (km/h)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={row.speedKmh}
                        onChange={(event) => updateRow(index, { speedKmh: event.target.value })}
                      />
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => removeRow(index)} title="Remove step">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addRow}>
                  <Plus className="mr-1 h-4 w-4" /> Add step
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={notation}
                  onChange={(event) => setNotation(event.target.value)}
                  className="min-h-[150px] w-full rounded-md border border-input bg-background/70 px-3 py-2 font-mono text-sm"
                  placeholder="Example: 3x(2m@14km/h,1m@8km/h), 10m@10km/h"
                />
                <p className="text-xs text-muted-foreground">
                  Supported: 10m@10km/h, 45s@5m/s, 3x(2m@14,1m@8)
                </p>
              </div>
            )}

            <div className="mt-4 panel-soft p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">steps: {parsed.segments.length}</Badge>
                <Badge variant="outline">duration: {formatDuration(workoutDuration)}</Badge>
                <Badge variant="outline">planned distance: {formatKm(workoutDistance)}</Badge>
              </div>

              {parsed.error ? (
                <p className="text-sm text-red-300">{parsed.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {parsed.segments.slice(0, 4).map(formatSegmentLabel).join(" | ")}
                  {parsed.segments.length > 4 ? " ..." : ""}
                </p>
              )}
            </div>
          </div>

          <div className="panel p-5 md:p-6" id="pipeline">
            <h3 className="mb-3 text-base font-semibold">3. Processing Pipeline</h3>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                The backend iterates through each record, rewrites <code>speed</code>/<code>enhancedSpeed</code> and{" "}
                <code>distance</code>, recalculates lap/session/activity totals, then re-encodes a valid FIT file.
              </p>
              <p>Heart rate, cadence, and other existing metrics are preserved.</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={processFit} disabled={isProcessing || !file || Boolean(parsed.error)}>
                {isProcessing ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  "Generate corrected file"
                )}
              </Button>

              {result ? (
                <Button variant="secondary" onClick={downloadCorrectedFile}>
                  <Download className="mr-2 h-4 w-4" /> Download corrected FIT
                </Button>
              ) : null}
            </div>

            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          </div>
        </section>

        <section className="space-y-6" id="preview">
          <div className="panel p-5 md:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Session Summary</h3>
              {result ? (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {result.fileName}
                </Badge>
              ) : null}
            </div>

            {result ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Duration" value={formatDuration(result.summary.durationSeconds)} />
                <Metric label="Records" value={String(result.summary.recordsCount)} />
                <Metric label="Original Distance" value={formatKm(result.summary.originalDistanceKm)} />
                <Metric label="Corrected Distance" value={formatKm(result.summary.correctedDistanceKm)} />
                <Metric label="Original Avg Speed" value={formatSpeed(result.summary.originalAvgSpeedKmh)} />
                <Metric label="Corrected Avg Speed" value={formatSpeed(result.summary.correctedAvgSpeedKmh)} />
                <Metric label="Original Peak Speed" value={formatSpeed(result.summary.maxOriginalSpeedKmh)} />
                <Metric label="Corrected Peak Speed" value={formatSpeed(result.summary.maxCorrectedSpeedKmh)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No data yet. Run the processing step to generate a session preview.
              </p>
            )}
          </div>

          <SpeedComparisonChart points={result?.points ?? []} />
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-soft p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
