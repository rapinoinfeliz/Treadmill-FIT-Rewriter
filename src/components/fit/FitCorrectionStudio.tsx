"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Download,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
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
import { cn, formatDuration, formatKm, formatSpeed } from "@/lib/utils";

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

type StepState = "idle" | "active" | "done";
type WorkflowStep = {
  key: string;
  label: string;
  state: StepState;
};

type StatusTone = "idle" | "working" | "success" | "error";

const comfortableClasses = {
  stack: "space-y-6",
  panel: "p-5 md:p-6",
  row: "p-3",
  rowGap: "gap-3",
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
  const hasValidWorkout = parsed.segments.length > 0 && !parsed.error;
  const hasResult = Boolean(result);

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const hasFile = Boolean(file);
    const canProcess = hasFile && hasValidWorkout;

    return [
      {
        key: "upload",
        label: "Upload",
        state: hasFile ? "done" : "active",
      },
      {
        key: "workout",
        label: "Workout",
        state: hasValidWorkout ? "done" : hasFile ? "active" : "idle",
      },
      {
        key: "process",
        label: "Process",
        state: hasResult ? "done" : canProcess || isProcessing ? "active" : "idle",
      },
      {
        key: "download",
        label: "Download",
        state: hasResult ? "done" : "idle",
      },
    ];
  }, [file, hasResult, hasValidWorkout, isProcessing]);

  const status = useMemo(
    (): { tone: StatusTone; title: string; message: string } => {
      if (isProcessing) {
        return {
          tone: "working",
          title: "Processing file",
          message: "Rewriting speed and distance records, then recalculating all totals.",
        };
      }

      if (error) {
        return {
          tone: "error",
          title: "Processing failed",
          message: error,
        };
      }

      if (result) {
        return {
          tone: "success",
          title: "Correction complete",
          message: "Preview validated. You can now download the corrected FIT file.",
        };
      }

      return {
        tone: "idle",
        title: "Ready to process",
        message: "Upload a FIT file and define your workout to start the rewrite pipeline.",
      };
    },
    [error, isProcessing, result]
  );

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
    setResult(null);

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
    <div className={cn("studio-shell enter-rise", comfortableClasses.stack)} id="studio">
      <section className={cn("panel panel-hero grid-fine relative overflow-hidden", comfortableClasses.panel)}>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-primary/90">Treadmill FIT Rewriter</p>
            <h1 className="text-2xl font-semibold leading-tight md:text-3xl">FIT treadmill correction studio</h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              Rewrite treadmill speed and distance while preserving existing heart rate, cadence, and sensor data.
            </p>
          </div>
        </div>

        <WorkflowProgress steps={workflowSteps} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <section className={comfortableClasses.stack}>
          <div className={cn("panel", comfortableClasses.panel)}>
            <h2 className="section-title">1. FIT File Upload</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Use your original treadmill activity file as the source for correction.
            </p>

            <label
              className={cn(
                "panel-soft flex cursor-pointer flex-col border border-dashed border-border/75 transition-colors hover:border-primary/45",
                comfortableClasses.row,
                comfortableClasses.rowGap
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".fit"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                  setResult(null);
                  setError(null);
                }}
              />

              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" /> Choose a .fit file
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
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

          <div className={cn("panel", comfortableClasses.panel)} id="parser">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">2. Real Workout Input</h2>
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
                  <div
                    key={`row-${index}`}
                    className={cn(
                      "panel-soft flex flex-wrap items-end",
                      comfortableClasses.row,
                      comfortableClasses.rowGap
                    )}
                  >
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
                        className="glass-input flex h-9 w-full rounded-md border px-2 text-sm"
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
                  className="glass-input min-h-[150px] w-full resize-y rounded-md border px-3 py-2 font-mono text-sm"
                  placeholder="Example: 3x(2m@14km/h,1m@8km/h), 10m@10km/h"
                />
                <p className="text-xs text-muted-foreground">
                  Supported: 10m@10km/h, 45s@5m/s, 3x(2m@14,1m@8)
                </p>
              </div>
            )}

            <div className={cn("panel-soft mt-4 text-sm", comfortableClasses.row)}>
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

          <div className={cn("panel", comfortableClasses.panel)} id="pipeline">
            <h2 className="section-title">3. Process and Export</h2>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                The backend rewrites <code>speed</code>/<code>enhancedSpeed</code> and <code>distance</code> for every
                record, then recalculates lap, session, and activity totals.
              </p>
              <p>Heart rate, cadence, and the remaining metrics are preserved from the original file.</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={processFit} disabled={isProcessing || !file || Boolean(parsed.error)}>
                {isProcessing ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <WandSparkles className="mr-2 h-4 w-4" /> Generate corrected file
                  </>
                )}
              </Button>

              {result ? (
                <Button variant="secondary" onClick={downloadCorrectedFile} className="micro-pop">
                  <Download className="mr-2 h-4 w-4" /> Download corrected FIT
                </Button>
              ) : null}
            </div>

            <StatusBanner tone={status.tone} title={status.title} message={status.message} />
          </div>
        </section>

        <section className={comfortableClasses.stack} id="preview">
          <div className={cn("panel", comfortableClasses.panel)}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">Session Summary</h2>
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
              <div className="empty-state">
                <WandSparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">No correction preview yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Run the processing step to generate metrics and verify the rewritten activity.
                  </p>
                </div>
              </div>
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

function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="mt-5 flex flex-wrap items-center gap-y-2" aria-label="Workflow progress">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-center">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors",
              step.state === "done" && "border-primary/70 bg-primary/10 text-primary",
              step.state === "active" && "border-sky-300/45 bg-sky-400/10 text-sky-100",
              step.state === "idle" && "border-border/80 bg-card/60 text-muted-foreground"
            )}
          >
            {step.state === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : step.state === "active" ? (
              <CircleDashed className="h-3.5 w-3.5 animate-spin-slow" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            {step.label}
          </span>

          {index < steps.length - 1 ? (
            <span
              className={cn(
                "mx-2 h-px w-7",
                step.state === "done" ? "bg-primary/60" : "bg-border/80"
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function StatusBanner({
  tone,
  title,
  message,
}: {
  tone: StatusTone;
  title: string;
  message: string;
}) {
  return (
    <div
      className={cn(
        "status-banner mt-4 flex items-start gap-3 rounded-lg border px-3 py-2.5",
        tone === "idle" && "border-border/80 bg-card/55",
        tone === "working" && "border-sky-300/35 bg-sky-400/10",
        tone === "success" && "border-emerald-300/35 bg-emerald-400/10 micro-pop",
        tone === "error" && "border-red-300/40 bg-red-400/10"
      )}
      data-tone={tone}
    >
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border",
          tone === "idle" && "border-border/90 bg-card/70 text-muted-foreground",
          tone === "working" && "border-sky-300/40 bg-sky-400/15 text-sky-100",
          tone === "success" && "border-emerald-300/45 bg-emerald-400/20 text-emerald-100",
          tone === "error" && "border-red-300/45 bg-red-400/20 text-red-100"
        )}
      >
        {tone === "working" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : tone === "success" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : tone === "error" ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
