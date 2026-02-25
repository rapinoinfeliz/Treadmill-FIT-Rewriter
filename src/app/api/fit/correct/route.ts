import { NextResponse } from "next/server";
import { correctFitActivity } from "@/lib/fit/correction";
import {
  BuilderSegmentInput,
  normalizeBuilderSegments,
  parseIntervalsNotation,
  WorkoutSegment,
} from "@/lib/fit/prescription";

export const runtime = "nodejs";

type BuilderPayload = {
  duration: number;
  unit: "s" | "m" | "h";
  speedKmh: number;
  name?: string;
};

const parseBuilderPayload = (raw: FormDataEntryValue | null): WorkoutSegment[] => {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Workout steps are missing.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse visual builder steps.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid visual builder step format.");
  }

  const normalized: BuilderSegmentInput[] = parsed.map((entry, index) => {
    if (entry === null || typeof entry !== "object") {
      throw new Error(`Step ${index + 1} is invalid.`);
    }

    const segment = entry as Partial<BuilderPayload>;

    return {
      duration: Number(segment.duration),
      unit: String(segment.unit ?? "m") as "s" | "m" | "h",
      speedKmh: Number(segment.speedKmh),
      name: typeof segment.name === "string" ? segment.name : undefined,
    };
  });

  return normalizeBuilderSegments(normalized);
};

const getSegmentsFromRequest = (formData: FormData): WorkoutSegment[] => {
  const mode = String(formData.get("mode") ?? "builder");
  const notation = String(formData.get("notation") ?? "").trim();

  if (mode === "notation") {
    return parseIntervalsNotation(notation);
  }

  if (mode === "builder") {
    return parseBuilderPayload(formData.get("builderSegments"));
  }

  if (notation.length > 0) {
    return parseIntervalsNotation(notation);
  }

  return parseBuilderPayload(formData.get("builderSegments"));
};

const buildOutputName = (inputName: string): string => {
  const trimmed = inputName.trim() || "activity.fit";
  const base = trimmed.replace(/\.fit$/i, "");
  return `${base}-corrected.fit`;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const fitFile = formData.get("fitFile");
    if (!(fitFile instanceof File)) {
      return NextResponse.json({ error: "Please upload a valid .fit file." }, { status: 400 });
    }

    const segments = getSegmentsFromRequest(formData);
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "Could not extract workout steps from input." },
        { status: 400 }
      );
    }

    const inputBytes = new Uint8Array(await fitFile.arrayBuffer());
    const result = correctFitActivity(inputBytes, segments);

    return NextResponse.json({
      fileName: buildOutputName(fitFile.name),
      correctedFitBase64: Buffer.from(result.correctedFitBytes).toString("base64"),
      points: result.points,
      summary: result.summary,
      segments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while processing FIT file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
