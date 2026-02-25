export type DurationUnit = "s" | "m" | "h";

export type BuilderSegmentInput = {
  duration: number;
  unit: DurationUnit;
  speedKmh: number;
  name?: string;
};

export type WorkoutSegment = {
  durationSeconds: number;
  speedKmh: number;
  name?: string;
};

const DURATION_ALIASES: Record<string, DurationUnit> = {
  s: "s",
  sec: "s",
  secs: "s",
  second: "s",
  seconds: "s",
  m: "m",
  min: "m",
  mins: "m",
  minute: "m",
  minutes: "m",
  h: "h",
  hr: "h",
  hrs: "h",
  hour: "h",
  hours: "h",
};

const SPEED_UNIT_ALIASES: Record<string, "kmh" | "mps" | "mph"> = {
  kmh: "kmh",
  "km/h": "kmh",
  kph: "kmh",
  kmph: "kmh",
  mps: "mps",
  "m/s": "mps",
  ms: "mps",
  mph: "mph",
  "mi/h": "mph",
};

const convertDurationToSeconds = (duration: number, unit: DurationUnit): number => {
  if (unit === "s") return duration;
  if (unit === "m") return duration * 60;
  return duration * 3600;
};

const convertSpeedToKmh = (value: number, unit: "kmh" | "mps" | "mph"): number => {
  if (unit === "kmh") return value;
  if (unit === "mps") return value * 3.6;
  return value * 1.609344;
};

const normalizeSegmentName = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[{}]/g, "").slice(0, 80);
};

const ensureSegment = (segment: WorkoutSegment, context: string): WorkoutSegment => {
  if (!Number.isFinite(segment.durationSeconds) || segment.durationSeconds <= 0) {
    throw new Error(`${context}: invalid duration.`);
  }
  if (!Number.isFinite(segment.speedKmh) || segment.speedKmh < 0) {
    throw new Error(`${context}: invalid speed.`);
  }

  return {
    durationSeconds: segment.durationSeconds,
    speedKmh: segment.speedKmh,
    name: normalizeSegmentName(segment.name),
  };
};

export const normalizeBuilderSegments = (inputs: BuilderSegmentInput[]): WorkoutSegment[] => {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error("Add at least one workout step.");
  }

  return inputs.map((input, index) => {
    const unit = DURATION_ALIASES[String(input.unit).toLowerCase()];
    if (!unit) {
      throw new Error(`Step ${index + 1}: invalid duration unit.`);
    }

    const durationSeconds = convertDurationToSeconds(Number(input.duration), unit);
    const speedKmh = Number(input.speedKmh);

    return ensureSegment(
      {
        durationSeconds,
        speedKmh,
        name: input.name,
      },
      `Step ${index + 1}`
    );
  });
};

class NotationParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): WorkoutSegment[] {
    const segments = this.parseSequence();
    if (segments.length === 0) {
      throw new Error("Workout notation is empty.");
    }

    this.skipWhitespace();
    if (!this.isEOF()) {
      throw this.error("Invalid text at the end of notation");
    }

    return segments;
  }

  private parseSequence(stopChar?: string): WorkoutSegment[] {
    const segments: WorkoutSegment[] = [];

    while (true) {
      this.skipWhitespace();

      const current = this.peek();

      if (current === null) {
        if (stopChar) {
          throw this.error(`Expected '${stopChar}' to close repetition`);
        }
        break;
      }

      if (stopChar && current === stopChar) {
        break;
      }

      if (this.isSeparator(current)) {
        this.index += 1;
        continue;
      }

      segments.push(...this.parseItem());

      this.skipWhitespace();
      const next = this.peek();
      if (next !== null && this.isSeparator(next)) {
        this.index += 1;
      }
    }

    return segments;
  }

  private parseItem(): WorkoutSegment[] {
    const firstNumber = this.parseNumber("Expected a number at the start of the step");
    this.skipWhitespace();

    const marker = this.peek();
    if (marker === "x" || marker === "X") {
      this.index += 1;
      this.skipWhitespace();
      this.expect("(");
      const nested = this.parseSequence(")");
      this.expect(")");

      const repeats = Math.floor(firstNumber);
      if (!Number.isFinite(repeats) || repeats <= 0) {
        throw this.error("Repetition count must be a positive integer");
      }

      const expanded: WorkoutSegment[] = [];
      for (let i = 0; i < repeats; i += 1) {
        expanded.push(...nested.map((segment) => ({ ...segment })));
      }

      return expanded;
    }

    const durationUnitToken = this.readWord();
    const durationUnit = DURATION_ALIASES[durationUnitToken.toLowerCase()];
    if (!durationUnit) {
      throw this.error(
        `Invalid duration unit '${durationUnitToken || ""}'. Use s, m or h.`
      );
    }

    this.skipWhitespace();
    const delimiter = this.peek();
    if (delimiter === "@" || delimiter === ":") {
      this.index += 1;
    }

    this.skipWhitespace();
    const speedValue = this.parseNumber("Expected speed after duration");

    this.skipWhitespace();
    const maybeUnit = this.peek();
    let speedUnit: "kmh" | "mps" | "mph" = "kmh";

    if (maybeUnit !== null && /[A-Za-z/]/.test(maybeUnit)) {
      const speedUnitToken = this.readWord().toLowerCase();
      const parsedSpeedUnit = SPEED_UNIT_ALIASES[speedUnitToken];
      if (!parsedSpeedUnit) {
        throw this.error(
          `Invalid speed unit '${speedUnitToken}'. Use km/h, m/s, or mph.`
        );
      }
      speedUnit = parsedSpeedUnit;
    }

    const durationSeconds = convertDurationToSeconds(firstNumber, durationUnit);
    const speedKmh = convertSpeedToKmh(speedValue, speedUnit);
    const name = this.parseOptionalName();

    return [
      ensureSegment(
        {
          durationSeconds,
          speedKmh,
          name,
        },
        "Notation"
      ),
    ];
  }

  private parseOptionalName(): string | undefined {
    this.skipWhitespace();

    if (this.peek() !== "{") {
      return undefined;
    }

    this.index += 1;
    const start = this.index;

    while (this.index < this.source.length && this.source[this.index] !== "}") {
      this.index += 1;
    }

    if (this.peek() !== "}") {
      throw this.error("Expected '}' to close step name");
    }

    const label = this.source.slice(start, this.index).trim();
    this.index += 1;

    return normalizeSegmentName(label);
  }

  private parseNumber(errorMessage: string): number {
    this.skipWhitespace();

    const start = this.index;
    let hasDot = false;

    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (/[0-9]/.test(char)) {
        this.index += 1;
        continue;
      }
      if (char === "." && !hasDot) {
        hasDot = true;
        this.index += 1;
        continue;
      }
      break;
    }

    const token = this.source.slice(start, this.index);
    if (!token) {
      throw this.error(errorMessage);
    }

    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw this.error(`${errorMessage}: '${token}'`);
    }

    return value;
  }

  private readWord(): string {
    const start = this.index;
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (/[A-Za-z/]/.test(char)) {
        this.index += 1;
      } else {
        break;
      }
    }

    return this.source.slice(start, this.index);
  }

  private expect(char: string): void {
    this.skipWhitespace();
    if (this.peek() !== char) {
      throw this.error(`Expected '${char}'`);
    }
    this.index += 1;
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) {
      this.index += 1;
    }
  }

  private isSeparator(char: string): boolean {
    return char === "," || char === ";" || char === "+";
  }

  private isEOF(): boolean {
    return this.index >= this.source.length;
  }

  private peek(): string | null {
    return this.isEOF() ? null : this.source[this.index];
  }

  private error(message: string): Error {
    const pointer = this.source.slice(Math.max(0, this.index - 12), this.index + 12);
    return new Error(`${message} (pos ${this.index + 1}). Context: "${pointer}"`);
  }
}

export const parseIntervalsNotation = (input: string): WorkoutSegment[] => {
  const parser = new NotationParser(input.trim());
  return parser.parse();
};

const formatCompactNumber = (value: number, maxDecimals = 3): string => {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(maxDecimals).replace(/\.?0+$/, "");
};

const durationToNotation = (durationSeconds: number): { value: number; unit: DurationUnit } => {
  const EPSILON = 1e-9;
  if (Math.abs(durationSeconds % 3600) <= EPSILON) {
    return { value: durationSeconds / 3600, unit: "h" };
  }
  if (Math.abs(durationSeconds % 60) <= EPSILON) {
    return { value: durationSeconds / 60, unit: "m" };
  }
  return { value: durationSeconds, unit: "s" };
};

export const serializeIntervalsNotation = (segments: WorkoutSegment[]): string => {
  return segments
    .map((segment) => {
      const duration = durationToNotation(segment.durationSeconds);
      const durationText = `${formatCompactNumber(duration.value)}${duration.unit}`;
      const speedText = `${formatCompactNumber(segment.speedKmh)}km/h`;
      const nameSuffix = segment.name ? `{${segment.name}}` : "";
      return `${durationText}@${speedText}${nameSuffix}`;
    })
    .join(", ");
};

export const totalDurationSeconds = (segments: WorkoutSegment[]): number => {
  return segments.reduce((total, segment) => total + segment.durationSeconds, 0);
};

export const totalDistanceKm = (segments: WorkoutSegment[]): number => {
  return segments.reduce(
    (total, segment) => total + (segment.durationSeconds / 3600) * segment.speedKmh,
    0
  );
};

export const speedAtElapsedSeconds = (segments: WorkoutSegment[], elapsedSeconds: number): number => {
  if (segments.length === 0) return 0;

  if (elapsedSeconds <= 0) {
    return segments[0].speedKmh;
  }

  const EPSILON = 1e-9;
  let cursor = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const end = cursor + segment.durationSeconds;
    if (elapsedSeconds < end - EPSILON) {
      return segment.speedKmh;
    }

    if (Math.abs(elapsedSeconds - end) <= EPSILON) {
      const next = segments[index + 1];
      if (!next) return segment.speedKmh;
      // At exact boundaries, prefer the faster side to avoid a 1-sample slow dip
      // that can reduce interval pace/distance in external workout analyzers.
      return Math.max(segment.speedKmh, next.speedKmh);
    }

    cursor = end;
  }

  return segments[segments.length - 1].speedKmh;
};

export const distanceMetersBetweenElapsedSeconds = (
  segments: WorkoutSegment[],
  startSeconds: number,
  endSeconds: number
): number => {
  if (segments.length === 0) return 0;

  const start = Math.max(startSeconds, 0);
  const end = Math.max(endSeconds, 0);
  if (end <= start) return 0;

  let cursor = 0;
  let totalKm = 0;

  for (const segment of segments) {
    const segStart = cursor;
    const segEnd = cursor + segment.durationSeconds;

    const overlapStart = Math.max(start, segStart);
    const overlapEnd = Math.min(end, segEnd);

    if (overlapEnd > overlapStart) {
      totalKm += ((overlapEnd - overlapStart) / 3600) * segment.speedKmh;
    }

    cursor = segEnd;
    if (cursor >= end) {
      break;
    }
  }

  // Keep previous behavior after workout end: hold last step speed.
  if (end > cursor) {
    const lastSpeed = segments[segments.length - 1].speedKmh;
    totalKm += ((end - cursor) / 3600) * lastSpeed;
  }

  return totalKm * 1000;
};

export const formatSegmentLabel = (segment: WorkoutSegment): string => {
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
};
