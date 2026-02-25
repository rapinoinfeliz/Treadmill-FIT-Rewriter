import type { CorrectionSummary, SpeedPreviewPoint } from "@/lib/fit/correction";
import type { DurationUnit, WorkoutSegment } from "@/lib/fit/prescription";

export type BuilderRow = {
  id: string;
  name: string;
  duration: string;
  unit: DurationUnit;
  speedKmh: string;
  pace: string;
};

export type BuilderSpeedDisplay = "kmh" | "pace";

export type StudioResult = {
  fileName: string;
  correctedFitBytes: Uint8Array;
  points: SpeedPreviewPoint[];
  summary: CorrectionSummary;
  segments: WorkoutSegment[];
};

export type StepState = "idle" | "active" | "done";

export type WorkflowStep = {
  key: string;
  label: string;
  state: StepState;
};

export type StatusTone = "idle" | "working" | "success" | "error";

export type DurationMismatchWarning = {
  fitDurationSeconds: number;
  workoutDurationSeconds: number;
  deltaSeconds: number;
};
