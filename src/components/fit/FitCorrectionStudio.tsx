"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SpeedComparisonChart } from "@/components/fit/SpeedComparisonChart";
import { FileUploadCard } from "@/components/fit/studio/FileUploadCard";
import { ProcessPanel } from "@/components/fit/studio/ProcessPanel";
import { SessionSummaryPanel } from "@/components/fit/studio/SessionSummaryPanel";
import type {
  BuilderRow,
  BuilderSpeedDisplay,
  DurationMismatchWarning,
  StatusTone,
  StudioResult,
  WorkflowStep,
} from "@/components/fit/studio/types";
import { WorkflowProgress } from "@/components/fit/studio/WorkflowProgress";
import { WorkoutInputCard } from "@/components/fit/studio/WorkoutInputCard";
import { correctFitActivity, inspectFitTimeline, type FitTimelineInfo } from "@/lib/fit/correction";
import {
  type DurationUnit,
  type WorkoutSegment,
  normalizeBuilderSegments,
  parseIntervalsNotation,
  serializeIntervalsNotation,
  totalDistanceKm,
  totalDurationSeconds,
} from "@/lib/fit/prescription";
import { cn, formatPaceInput, parsePaceInput } from "@/lib/utils";

const comfortableClasses = {
  stack: "space-y-6",
  panel: "p-5 md:p-6",
};

const DEFAULT_NOTATION =
  "10m@10km/h{Step 1}, 5m@12km/h{Step 2}, 5m@9km/h{Step 3}";

const createRowId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Math.random().toString(36).slice(2, 10)}`;
};

const formatInputNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(3).replace(/\.?0+$/, "");
};

const chooseDurationUnit = (durationSeconds: number): DurationUnit => {
  const EPSILON = 1e-9;
  if (Math.abs(durationSeconds % 3600) <= EPSILON) return "h";
  if (Math.abs(durationSeconds % 60) <= EPSILON) return "m";
  return "s";
};

const rowFromSegment = (segment: WorkoutSegment, index: number): BuilderRow => {
  const unit = chooseDurationUnit(segment.durationSeconds);
  const durationValue =
    unit === "h"
      ? segment.durationSeconds / 3600
      : unit === "m"
        ? segment.durationSeconds / 60
        : segment.durationSeconds;

  return {
    id: createRowId(),
    name: segment.name?.trim() || `Step ${index + 1}`,
    duration: formatInputNumber(durationValue),
    unit,
    speedKmh: formatInputNumber(segment.speedKmh),
    pace: formatPaceInput(segment.speedKmh),
  };
};

const rowsFromSegments = (segments: WorkoutSegment[]): BuilderRow[] => {
  if (segments.length === 0) {
    return [makeDefaultRow(1)];
  }
  return segments.map((segment, index) => rowFromSegment(segment, index));
};

const rowsEqual = (a: BuilderRow[], b: BuilderRow[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].name !== b[i].name ||
      a[i].duration !== b[i].duration ||
      a[i].unit !== b[i].unit ||
      a[i].speedKmh !== b[i].speedKmh
    ) {
      return false;
    }
  }
  return true;
};

const makeDefaultRow = (index: number): BuilderRow => {
  const speedKmh = "10";
  return {
    id: createRowId(),
    name: `Step ${index}`,
    duration: "10",
    unit: "m",
    speedKmh,
    pace: formatPaceInput(Number(speedKmh)),
  };
};

const parseNumericInput = (value: string): number => {
  if (value.trim() === "") return Number.NaN;
  return Number(value);
};

export function FitCorrectionStudio() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileReadTokenRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [fileTimeline, setFileTimeline] = useState<FitTimelineInfo | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [mode, setMode] = useState<"builder" | "notation">("builder");
  const [speedDisplay, setSpeedDisplay] = useState<BuilderSpeedDisplay>("kmh");
  const [rows, setRows] = useState<BuilderRow[]>(() => {
    try {
      return rowsFromSegments(parseIntervalsNotation(DEFAULT_NOTATION));
    } catch {
      return [makeDefaultRow(1)];
    }
  });
  const [notation, setNotation] = useState(DEFAULT_NOTATION);
  const [result, setResult] = useState<StudioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const builderPayload = useMemo(
    () =>
      rows.map((row) => ({
        name: row.name,
        duration: parseNumericInput(row.duration),
        unit: row.unit,
        speedKmh: parseNumericInput(row.speedKmh),
      })),
    [rows]
  );

  const parsedBuilder = useMemo(() => {
    try {
      const segments = normalizeBuilderSegments(builderPayload);
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
  }, [builderPayload]);

  const parsedNotation = useMemo(() => {
    try {
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
  }, [notation]);

  const parsed = mode === "builder" ? parsedBuilder : parsedNotation;

  useEffect(() => {
    if (mode !== "builder" || parsedBuilder.error) return;
    const nextNotation = serializeIntervalsNotation(parsedBuilder.segments);
    setNotation((current) => (current === nextNotation ? current : nextNotation));
  }, [mode, parsedBuilder.error, parsedBuilder.segments]);

  useEffect(() => {
    if (mode !== "notation" || parsedNotation.error) return;
    const nextRows = rowsFromSegments(parsedNotation.segments);
    setRows((current) => (rowsEqual(current, nextRows) ? current : nextRows));
  }, [mode, parsedNotation.error, parsedNotation.segments]);

  const workoutDurationSeconds = totalDurationSeconds(parsed.segments);
  const workoutDistanceKm = totalDistanceKm(parsed.segments);
  const hasValidWorkout = parsed.segments.length > 0 && !parsed.error;
  const hasResult = Boolean(result);
  const canProcess = Boolean(file) && hasValidWorkout;

  const durationWarning = useMemo<DurationMismatchWarning | null>(() => {
    if (!fileTimeline || !hasValidWorkout) return null;
    const delta = Math.abs(fileTimeline.durationSeconds - workoutDurationSeconds);
    if (delta < 5) return null;
    return {
      fitDurationSeconds: fileTimeline.durationSeconds,
      workoutDurationSeconds,
      deltaSeconds: delta,
    };
  }, [fileTimeline, hasValidWorkout, workoutDurationSeconds]);

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const hasFile = Boolean(file);
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
  }, [file, hasResult, hasValidWorkout, canProcess, isProcessing]);

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
    setRows((current) => [...current, makeDefaultRow(current.length + 1)]);
  };

  const setRowSpeed = (index: number, value: string) => {
    if (speedDisplay === "kmh") {
      const speed = Number(value);
      updateRow(index, {
        speedKmh: value,
        pace: Number.isFinite(speed) && speed > 0 ? formatPaceInput(speed) : "",
      });
      return;
    }

    const parsedPace = parsePaceInput(value);
    updateRow(index, {
      pace: value,
      speedKmh: parsedPace === null ? "" : formatInputNumber(parsedPace),
    });
  };

  const setSpeedDisplayMode = (nextMode: BuilderSpeedDisplay) => {
    setSpeedDisplay(nextMode);
    if (nextMode === "pace") {
      setRows((current) =>
        current.map((row) => ({
          ...row,
          pace: Number.isFinite(Number(row.speedKmh)) ? formatPaceInput(Number(row.speedKmh)) : row.pace,
        }))
      );
    }
  };

  const handleModeChange = (nextMode: "builder" | "notation") => {
    if (nextMode === "builder" && parsedNotation.error) return;
    if (nextMode === "notation" && parsedBuilder.error) return;
    setMode(nextMode);
  };

  const handleFileSelected = async (selected: File | null) => {
    const token = fileReadTokenRef.current + 1;
    fileReadTokenRef.current = token;

    setFile(selected);
    setFileTimeline(null);
    setResult(null);
    setError(null);

    if (!selected) return;

    try {
      const bytes = new Uint8Array(await selected.arrayBuffer());
      const timeline = inspectFitTimeline(bytes);
      if (token !== fileReadTokenRef.current) return;
      setFileTimeline(timeline);
    } catch (inspectionError) {
      if (token !== fileReadTokenRef.current) return;
      setError(
        inspectionError instanceof Error
          ? inspectionError.message
          : "Unexpected failure while reading FIT timeline."
      );
    }
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
      const inputBytes = new Uint8Array(await file.arrayBuffer());
      const corrected = correctFitActivity(inputBytes, parsed.segments);

      const trimmed = file.name.trim() || "activity.fit";
      const base = trimmed.replace(/\.fit$/i, "");

      setResult({
        fileName: `${base}-corrected.fit`,
        correctedFitBytes: corrected.correctedFitBytes,
        points: corrected.points,
        summary: corrected.summary,
        segments: parsed.segments,
      });
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

    const safeBytes = Uint8Array.from(result.correctedFitBytes);
    const blob = new Blob([safeBytes], { type: "application/octet-stream" });
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
          <FileUploadCard
            file={file}
            fileInputRef={fileInputRef}
            isDragging={isDraggingFile}
            onFileSelected={handleFileSelected}
            onDragStateChange={setIsDraggingFile}
          />

          <WorkoutInputCard
            mode={mode}
            onModeChange={handleModeChange}
            speedDisplay={speedDisplay}
            onSpeedDisplayChange={setSpeedDisplayMode}
            rows={rows}
            onRowNameChange={(index, value) => updateRow(index, { name: value })}
            onRowDurationChange={(index, value) => updateRow(index, { duration: value })}
            onRowDurationUnitChange={(index, value) => updateRow(index, { unit: value })}
            onRowSpeedChange={setRowSpeed}
            onRemoveRow={removeRow}
            onAddRow={addRow}
            notation={notation}
            onNotationChange={setNotation}
            segments={parsed.segments}
            parsedError={parsed.error}
            workoutDurationSeconds={workoutDurationSeconds}
            workoutDistanceKm={workoutDistanceKm}
            durationWarning={durationWarning}
          />

          <ProcessPanel
            isProcessing={isProcessing}
            canProcess={canProcess}
            hasResult={hasResult}
            onProcess={processFit}
            onDownload={downloadCorrectedFile}
            status={status}
          />
        </section>

        <section className={comfortableClasses.stack} id="preview">
          <SessionSummaryPanel result={result} />
          <SpeedComparisonChart points={result?.points ?? []} />
        </section>
      </div>
    </div>
  );
}
