import { Decoder, Encoder, Profile, Stream, Utils } from "@garmin/fitsdk";
import {
  distanceMetersBetweenElapsedSeconds,
  speedAtElapsedSeconds,
  WorkoutSegment,
} from "@/lib/fit/prescription";

type FitMessage = Record<string, unknown> & {
  developerFields?: Record<string, unknown>;
};

type OrderedMessage = {
  mesgNum: number;
  message: FitMessage;
};

type RecordState = {
  timestampMs: number;
  elapsedSeconds: number;
  originalSpeedMps: number;
  originalDistanceM: number | null;
  correctedSpeedMps: number;
  correctedDistanceM: number;
  orderedIndexes: number[];
};

export type SpeedPreviewPoint = {
  elapsedSeconds: number;
  originalSpeedKmh: number;
  correctedSpeedKmh: number;
};

export type CorrectionSummary = {
  durationSeconds: number;
  originalDistanceKm: number;
  correctedDistanceKm: number;
  originalAvgSpeedKmh: number;
  correctedAvgSpeedKmh: number;
  maxOriginalSpeedKmh: number;
  maxCorrectedSpeedKmh: number;
  recordsCount: number;
};

export type FitCorrectionResult = {
  correctedFitBytes: Uint8Array;
  points: SpeedPreviewPoint[];
  summary: CorrectionSummary;
};

const FIT_EPOCH_MS =
  typeof Utils?.FIT_EPOCH_MS === "number" ? Number(Utils.FIT_EPOCH_MS) : 631065600000;

const MESG_NUM = {
  fileId: Number(Profile?.MesgNum?.FILE_ID ?? 0),
  record: Number(Profile?.MesgNum?.RECORD ?? 20),
  lap: Number(Profile?.MesgNum?.LAP ?? 19),
  segmentLap: Number(Profile?.MesgNum?.SEGMENT_LAP ?? 142),
  session: Number(Profile?.MesgNum?.SESSION ?? 18),
  activity: Number(Profile?.MesgNum?.ACTIVITY ?? 34),
  event: Number(Profile?.MesgNum?.EVENT ?? 21),
  workout: Number(Profile?.MesgNum?.WORKOUT ?? 26),
  workoutStep: Number(Profile?.MesgNum?.WORKOUT_STEP ?? 27),
  workoutSession: Number(Profile?.MesgNum?.WORKOUT_SESSION ?? 158),
  trainingFile: Number(Profile?.MesgNum?.TRAINING_FILE ?? 72),
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const toNumber = (value: unknown): number | null => {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  if (isFiniteNumber(value)) {
    const parsed = new Date(value * 1000 + FIT_EPOCH_MS);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const deepClone = <T>(value: T): T => {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = deepClone(entry);
    }
    return output as T;
  }

  return value;
};

const mpsToKmh = (mps: number): number => mps * 3.6;

const readSpeedCandidate = (message: FitMessage): number | null => {
  const enhanced = toNumber(message.enhancedSpeed);
  if (enhanced !== null && enhanced >= 0) return enhanced;

  const speed = toNumber(message.speed);
  if (speed !== null && speed >= 0) return speed;

  return null;
};

const getTimestampMs = (message: FitMessage): number | null => {
  const parsed = toDate(message.timestamp);
  return parsed ? parsed.getTime() : null;
};

const getStartMs = (message: FitMessage, fallback: number): number => {
  const parsed = toDate(message.startTime);
  return parsed ? parsed.getTime() : fallback;
};

const findClosestIndex = (records: RecordState[], timestampMs: number): number => {
  if (records.length <= 1) return 0;

  if (timestampMs <= records[0].timestampMs) return 0;
  if (timestampMs >= records[records.length - 1].timestampMs) return records.length - 1;

  let low = 0;
  let high = records.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTs = records[mid].timestampMs;

    if (midTs === timestampMs) return mid;
    if (midTs < timestampMs) low = mid + 1;
    else high = mid - 1;
  }

  return Math.max(0, low - 1);
};

const interpolateStateAt = (
  records: RecordState[],
  timestampMs: number
): { distanceM: number; speedMps: number } => {
  if (records.length === 0) {
    return { distanceM: 0, speedMps: 0 };
  }

  if (timestampMs <= records[0].timestampMs) {
    return {
      distanceM: records[0].correctedDistanceM,
      speedMps: records[0].correctedSpeedMps,
    };
  }

  if (timestampMs >= records[records.length - 1].timestampMs) {
    const last = records[records.length - 1];
    return {
      distanceM: last.correctedDistanceM,
      speedMps: last.correctedSpeedMps,
    };
  }

  const i = findClosestIndex(records, timestampMs);
  const a = records[i];
  const b = records[Math.min(i + 1, records.length - 1)];

  if (b.timestampMs <= a.timestampMs) {
    return {
      distanceM: a.correctedDistanceM,
      speedMps: a.correctedSpeedMps,
    };
  }

  const ratio = (timestampMs - a.timestampMs) / (b.timestampMs - a.timestampMs);

  return {
    distanceM: a.correctedDistanceM + (b.correctedDistanceM - a.correctedDistanceM) * ratio,
    speedMps: a.correctedSpeedMps + (b.correctedSpeedMps - a.correctedSpeedMps) * ratio,
  };
};

const buildPreviewPoints = (records: RecordState[]): SpeedPreviewPoint[] => {
  if (records.length === 0) return [];

  const maxPoints = 900;
  const step = Math.max(1, Math.ceil(records.length / maxPoints));

  const points: SpeedPreviewPoint[] = [];

  for (let index = 0; index < records.length; index += step) {
    const item = records[index];
    points.push({
      elapsedSeconds: item.elapsedSeconds,
      originalSpeedKmh: mpsToKmh(item.originalSpeedMps),
      correctedSpeedKmh: mpsToKmh(item.correctedSpeedMps),
    });
  }

  const last = records[records.length - 1];
  const hasLast = points.length > 0 && points[points.length - 1].elapsedSeconds === last.elapsedSeconds;
  if (!hasLast) {
    points.push({
      elapsedSeconds: last.elapsedSeconds,
      originalSpeedKmh: mpsToKmh(last.originalSpeedMps),
      correctedSpeedKmh: mpsToKmh(last.correctedSpeedMps),
    });
  }

  return points;
};

const applyRangeSummary = (message: FitMessage, records: RecordState[]): void => {
  if (records.length === 0) return;

  const firstTs = records[0].timestampMs;
  const lastTs = records[records.length - 1].timestampMs;
  const sourceDurationSeconds = Math.max(
    toNumber(message.totalTimerTime) ?? toNumber(message.totalElapsedTime) ?? 0,
    0
  );

  let startMs = getStartMs(message, firstTs);
  let endMs = getTimestampMs(message);

  if (endMs === null && sourceDurationSeconds > 0) {
    endMs = startMs + sourceDurationSeconds * 1000;
  }

  if (endMs === null) {
    endMs = lastTs;
  }

  if (startMs > endMs) {
    const temp = startMs;
    startMs = endMs;
    endMs = temp;
  }

  if (endMs <= startMs) {
    if (sourceDurationSeconds > 0) {
      endMs = startMs + sourceDurationSeconds * 1000;
    } else {
      startMs = firstTs;
      endMs = lastTs;
    }
  }

  startMs = Math.max(startMs, firstTs);
  endMs = Math.min(endMs, lastTs);

  if (endMs <= startMs) {
    startMs = firstTs;
    endMs = lastTs;
  }

  const start = interpolateStateAt(records, startMs);
  const end = interpolateStateAt(records, endMs);

  const totalTimerTime = Math.max((endMs - startMs) / 1000, 0);
  const totalDistance = Math.max(end.distanceM - start.distanceM, 0);
  const avgSpeed = totalTimerTime > 0 ? totalDistance / totalTimerTime : 0;

  let maxSpeed = 0;
  const from = findClosestIndex(records, startMs);
  const to = findClosestIndex(records, endMs);

  for (let i = from; i <= to; i += 1) {
    const speed = records[i].correctedSpeedMps;
    if (speed > maxSpeed) maxSpeed = speed;
  }

  if (maxSpeed === 0) {
    maxSpeed = Math.max(start.speedMps, end.speedMps);
  }

  // Preserve message schema: only mutate fields that already exist.
  if ("totalTimerTime" in message) message.totalTimerTime = totalTimerTime;
  if ("totalElapsedTime" in message) message.totalElapsedTime = totalTimerTime;
  if ("totalDistance" in message) message.totalDistance = totalDistance;
  if ("avgSpeed" in message) message.avgSpeed = avgSpeed;
  if ("maxSpeed" in message) message.maxSpeed = maxSpeed;
  if ("enhancedAvgSpeed" in message) message.enhancedAvgSpeed = avgSpeed;
  if ("enhancedMaxSpeed" in message) message.enhancedMaxSpeed = maxSpeed;
};

const computeIntegratedOriginalDistance = (records: RecordState[]): number => {
  if (records.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < records.length; i += 1) {
    const prev = records[i - 1];
    const cur = records[i];
    const dt = Math.max((cur.timestampMs - prev.timestampMs) / 1000, 0);
    total += ((prev.originalSpeedMps + cur.originalSpeedMps) / 2) * dt;
  }

  return total;
};

const decodeMessages = (fitBytes: Uint8Array): {
  messages: OrderedMessage[];
  fieldDescriptions: Record<string, { developerDataIdMesg: unknown; fieldDescriptionMesg: unknown }>;
} => {
  type StreamFactory = {
    fromByteArray?: (input: number[]) => ReturnType<typeof Stream.fromBuffer>;
    fromArrayBuffer?: (input: ArrayBuffer) => ReturnType<typeof Stream.fromBuffer>;
  };
  const streamFactory = Stream as unknown as StreamFactory;
  const fitBytesSafe = Uint8Array.from(fitBytes);
  const fitArrayBuffer = fitBytesSafe.buffer;

  const stream =
    (streamFactory.fromByteArray?.(Array.from(fitBytesSafe)) ??
      streamFactory.fromArrayBuffer?.(fitArrayBuffer)) ??
    null;

  if (!stream) {
    throw new Error("Could not initialize FIT stream decoder.");
  }

  if (!Decoder.isFIT(stream)) {
    throw new Error("Invalid file: this does not look like a .fit activity.");
  }

  stream.reset();

  const decoder = new Decoder(stream);
  const ordered: OrderedMessage[] = [];
  const fieldDescriptions: Record<
    string,
    { developerDataIdMesg: unknown; fieldDescriptionMesg: unknown }
  > = {};

  const { errors } = decoder.read({
    convertDateTimesToDates: true,
    convertTypesToStrings: true,
    applyScaleAndOffset: true,
    // Preserve original message schemas to maximize third-party import compatibility.
    expandSubFields: false,
    expandComponents: false,
    includeUnknownData: false,
    mergeHeartRates: false,
    mesgListener: (mesgNum: number, message: FitMessage) => {
      ordered.push({ mesgNum, message: deepClone(message) });
    },
    fieldDescriptionListener: (
      key: string | number,
      developerDataIdMesg: unknown,
      fieldDescriptionMesg: unknown
    ) => {
      fieldDescriptions[String(key)] = {
        developerDataIdMesg: deepClone(developerDataIdMesg),
        fieldDescriptionMesg: deepClone(fieldDescriptionMesg),
      };
    },
  });

  if (errors.length > 0) {
    const detail = errors
      .map((entry: unknown) => {
        if (entry instanceof Error) return entry.message;
        return String(entry);
      })
      .join("; ");

    throw new Error(`Failed to decode FIT file: ${detail}`);
  }

  return { messages: ordered, fieldDescriptions };
};

const injectWorkoutMessages = (
  messages: OrderedMessage[],
  segments: WorkoutSegment[],
  records: RecordState[]
): OrderedMessage[] => {
  const computeHash32 = (input: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash === 0 ? 1 : hash;
  };

  const getTimestampMsAtElapsed = (elapsedSeconds: number): number => {
    if (elapsedSeconds <= 0) return records[0].timestampMs;

    const last = records[records.length - 1];
    if (elapsedSeconds >= last.elapsedSeconds) return last.timestampMs;

    let low = 0;
    let high = records.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midElapsed = records[mid].elapsedSeconds;

      if (midElapsed === elapsedSeconds) return records[mid].timestampMs;
      if (midElapsed < elapsedSeconds) low = mid + 1;
      else high = mid - 1;
    }

    const leftIndex = Math.max(0, low - 1);
    const rightIndex = Math.min(leftIndex + 1, records.length - 1);
    const left = records[leftIndex];
    const right = records[rightIndex];

    if (right.elapsedSeconds <= left.elapsedSeconds) return left.timestampMs;

    const ratio = (elapsedSeconds - left.elapsedSeconds) / (right.elapsedSeconds - left.elapsedSeconds);
    return Math.round(left.timestampMs + (right.timestampMs - left.timestampMs) * ratio);
  };

  const summarizeRange = (startMs: number, endMs: number) => {
    if (endMs < startMs) {
      const temp = startMs;
      startMs = endMs;
      endMs = temp;
    }

    startMs = Math.max(startMs, records[0].timestampMs);
    endMs = Math.min(endMs, records[records.length - 1].timestampMs);

    if (endMs < startMs) {
      endMs = startMs;
    }

    const start = interpolateStateAt(records, startMs);
    const end = interpolateStateAt(records, endMs);

    const totalTimerTime = Math.max((endMs - startMs) / 1000, 0);
    const totalDistance = Math.max(end.distanceM - start.distanceM, 0);
    const avgSpeed = totalTimerTime > 0 ? totalDistance / totalTimerTime : 0;

    let maxSpeed = 0;
    const from = findClosestIndex(records, startMs);
    const to = findClosestIndex(records, endMs);
    for (let i = from; i <= to; i += 1) {
      if (records[i].correctedSpeedMps > maxSpeed) {
        maxSpeed = records[i].correctedSpeedMps;
      }
    }

    if (maxSpeed === 0) {
      maxSpeed = Math.max(start.speedMps, end.speedMps);
    }

    return {
      startMs,
      endMs,
      totalTimerTime,
      totalDistance,
      avgSpeed,
      maxSpeed,
    };
  };

  const buildWorkoutLapMessages = (): { laps: OrderedMessage[]; segmentLaps: OrderedMessage[] } => {
    const lapMessages: OrderedMessage[] = [];
    const segmentLapMessages: OrderedMessage[] = [];
    const activityStartMs = records[0].timestampMs;
    const activityEndMs = records[records.length - 1].timestampMs;
    let elapsedCursor = 0;

    for (let stepIndex = 0; stepIndex < segments.length; stepIndex += 1) {
      const segment = segments[stepIndex];
      const startMs = getTimestampMsAtElapsed(elapsedCursor);
      const endMs = getTimestampMsAtElapsed(elapsedCursor + segment.durationSeconds);

      if (startMs >= activityEndMs) {
        break;
      }

      const summary = summarizeRange(startMs, endMs);
      lapMessages.push({
        mesgNum: MESG_NUM.lap,
        message: {
          timestamp: new Date(activityStartMs),
          startTime: new Date(summary.startMs),
          totalElapsedTime: summary.totalTimerTime,
          totalTimerTime: summary.totalTimerTime,
          totalDistance: summary.totalDistance,
          avgSpeed: summary.avgSpeed,
          maxSpeed: summary.maxSpeed,
          enhancedAvgSpeed: summary.avgSpeed,
          enhancedMaxSpeed: summary.maxSpeed,
          messageIndex: stepIndex,
          wktStepIndex: stepIndex,
          event: "lap",
          eventType: "stop",
          lapTrigger: "time",
          intensity: segment.speedKmh > 0.1 ? "active" : "recovery",
          sport: "running",
          subSport: "treadmill",
        },
      });

      segmentLapMessages.push({
        mesgNum: MESG_NUM.segmentLap,
        message: {
          timestamp: new Date(activityStartMs),
          startTime: new Date(summary.startMs),
          totalElapsedTime: summary.totalTimerTime,
          totalTimerTime: summary.totalTimerTime,
          totalDistance: summary.totalDistance,
          avgSpeed: summary.avgSpeed,
          maxSpeed: summary.maxSpeed,
          messageIndex: stepIndex,
          wktStepIndex: stepIndex,
          event: "lap",
          eventType: "stop",
          sport: "running",
          subSport: "treadmill",
        },
      });

      elapsedCursor += segment.durationSeconds;
    }

    const tailStartMs = Math.min(getTimestampMsAtElapsed(elapsedCursor), activityEndMs);
    const tailSummary = summarizeRange(tailStartMs, activityEndMs);
    lapMessages.push({
      mesgNum: MESG_NUM.lap,
      message: {
        timestamp: new Date(activityStartMs),
        startTime: new Date(tailSummary.startMs),
        totalElapsedTime: tailSummary.totalTimerTime,
        totalTimerTime: tailSummary.totalTimerTime,
        totalDistance: tailSummary.totalDistance,
        avgSpeed: tailSummary.avgSpeed,
        maxSpeed: tailSummary.maxSpeed,
        enhancedAvgSpeed: tailSummary.avgSpeed,
        enhancedMaxSpeed: tailSummary.maxSpeed,
        messageIndex: lapMessages.length,
        event: "lap",
        eventType: "stop",
        lapTrigger: "sessionEnd",
        sport: "running",
        subSport: "treadmill",
      },
    });

    return {
      laps: lapMessages,
      segmentLaps: segmentLapMessages,
    };
  };

  const generatedLapData = buildWorkoutLapMessages();
  const generatedLaps = generatedLapData.laps;
  const generatedSegmentLaps = generatedLapData.segmentLaps;

  const base = messages.filter((entry) => {
    if (
      entry.mesgNum === MESG_NUM.lap ||
      entry.mesgNum === MESG_NUM.segmentLap ||
      entry.mesgNum === MESG_NUM.workout ||
      entry.mesgNum === MESG_NUM.workoutStep ||
      entry.mesgNum === MESG_NUM.workoutSession ||
      entry.mesgNum === MESG_NUM.trainingFile
    ) {
      return false;
    }

    if (entry.mesgNum !== MESG_NUM.event) {
      return true;
    }

    const eventName = String(entry.message.event ?? "");
    return eventName !== "workout" && eventName !== "workoutStep";
  });

  const workout: OrderedMessage = {
    mesgNum: MESG_NUM.workout,
    message: {
      sport: "running",
      subSport: "generic",
      capabilities: "tcx",
      numValidSteps: segments.length,
      wktName: "Treadmill Corrector",
      wktDescription: "Workout injected by Treadmill Corrector",
    },
  };

  const steps: OrderedMessage[] = segments.map((segment, index) => {
    const target = Math.round((segment.speedKmh / 3.6) * 1000);
    const durationMs = Math.round(segment.durationSeconds * 1000);
    const stepName = segment.name?.trim() || `Step ${index + 1}`;

    return {
      mesgNum: MESG_NUM.workoutStep,
      message: {
        messageIndex: index,
        wktStepName: stepName,
        durationType: "time",
        durationValue: durationMs,
        targetType: "speed",
        targetValue: 0,
        customTargetValueLow: target,
        customTargetValueHigh: target,
        intensity: "active",
        notes: `${stepName}: ${segment.durationSeconds}s @ ${segment.speedKmh.toFixed(1)} km/h`,
      },
    };
  });

  const fileId = messages.find((entry) => entry.mesgNum === MESG_NUM.fileId)?.message;
  const hasTrainingFileSource =
    fileId &&
    "manufacturer" in fileId &&
    "serialNumber" in fileId;

  const sourceWorkoutSeed = segments
    .map(
      (segment, index) =>
        `${index + 1}:${segment.durationSeconds.toFixed(3)}@${segment.speedKmh.toFixed(3)}:${segment.name ?? ""}`
    )
    .join("|");
  const workoutSerialNumber = computeHash32(sourceWorkoutSeed);
  const workoutCreatedMs = Math.max(records[0].timestampMs - 60_000, FIT_EPOCH_MS + 1_000);

  const activityStartTime = new Date(records[0].timestampMs);

  const trainingFile: OrderedMessage | null = hasTrainingFileSource
    ? {
        mesgNum: MESG_NUM.trainingFile,
        message: {
          timestamp: activityStartTime,
          type: "workout",
          manufacturer: fileId.manufacturer,
          product: 65534,
          serialNumber: workoutSerialNumber,
          timeCreated: new Date(workoutCreatedMs),
        },
      }
    : null;

  const staticWorkoutMessages = [...generatedLaps, ...generatedSegmentLaps];
  if (trainingFile) {
    staticWorkoutMessages.push(trainingFile);
  }
  staticWorkoutMessages.push(workout, ...steps);

  const insertionIndex = base.findIndex((entry) => entry.mesgNum === MESG_NUM.record);
  const withStatic =
    insertionIndex >= 0
      ? [
          ...base.slice(0, insertionIndex),
          ...staticWorkoutMessages,
          ...base.slice(insertionIndex),
        ]
      : [...base, ...staticWorkoutMessages];

  withStatic.forEach((entry) => {
    if (entry.mesgNum !== MESG_NUM.session) return;
    if ("numLaps" in entry.message) entry.message.numLaps = generatedLaps.length;
    if ("firstLapIndex" in entry.message) entry.message.firstLapIndex = 0;
  });

  return withStatic;
};

const collectRecordStates = (messages: OrderedMessage[], segments: WorkoutSegment[]): RecordState[] => {
  const byTimestamp = new Map<number, RecordState>();

  messages.forEach((entry, orderedIndex) => {
    if (entry.mesgNum !== MESG_NUM.record) return;

    const timestampMs = getTimestampMs(entry.message);
    if (timestampMs === null) return;

    const speedCandidate = readSpeedCandidate(entry.message);
    const distanceCandidate = toNumber(entry.message.distance);

    const existing = byTimestamp.get(timestampMs);
    if (existing) {
      existing.orderedIndexes.push(orderedIndex);
      if (speedCandidate !== null) existing.originalSpeedMps = speedCandidate;
      if (distanceCandidate !== null) existing.originalDistanceM = distanceCandidate;
      return;
    }

    byTimestamp.set(timestampMs, {
      timestampMs,
      elapsedSeconds: 0,
      originalSpeedMps: speedCandidate ?? 0,
      originalDistanceM: distanceCandidate,
      correctedSpeedMps: 0,
      correctedDistanceM: 0,
      orderedIndexes: [orderedIndex],
    });
  });

  const records = [...byTimestamp.values()].sort((a, b) => a.timestampMs - b.timestampMs);

  if (records.length < 2) {
    throw new Error("Could not find enough record messages in the FIT file.");
  }

  const firstTimestampMs = records[0].timestampMs;
  const firstKnownDistance = records.find((item) => item.originalDistanceM !== null)?.originalDistanceM ?? 0;

  let cumulativeDistance = firstKnownDistance;

  for (let i = 0; i < records.length; i += 1) {
    const current = records[i];
    const elapsedSeconds = Math.max((current.timestampMs - firstTimestampMs) / 1000, 0);
    current.elapsedSeconds = elapsedSeconds;

    const correctedSpeedKmh = speedAtElapsedSeconds(segments, elapsedSeconds);
    const correctedSpeedMps = Math.max(correctedSpeedKmh / 3.6, 0);
    current.correctedSpeedMps = correctedSpeedMps;

    if (i === 0) {
      current.correctedDistanceM = cumulativeDistance;
      continue;
    }

    const prev = records[i - 1];
    const deltaDistance = distanceMetersBetweenElapsedSeconds(
      segments,
      prev.elapsedSeconds,
      current.elapsedSeconds
    );
    cumulativeDistance += deltaDistance;
    current.correctedDistanceM = cumulativeDistance;
  }

  return records;
};

const patchMessages = (messages: OrderedMessage[], records: RecordState[]): void => {
  if (records.length === 0) return;

  const byOrderedIndex = new Map<number, RecordState>();
  records.forEach((record) => {
    record.orderedIndexes.forEach((index) => {
      byOrderedIndex.set(index, record);
    });
  });

  for (let orderedIndex = 0; orderedIndex < messages.length; orderedIndex += 1) {
    const entry = messages[orderedIndex];

    if (entry.mesgNum === MESG_NUM.record) {
      const record = byOrderedIndex.get(orderedIndex);
      if (!record) continue;

      if ("speed" in entry.message) entry.message.speed = record.correctedSpeedMps;
      if ("enhancedSpeed" in entry.message) entry.message.enhancedSpeed = record.correctedSpeedMps;
      if ("distance" in entry.message) entry.message.distance = record.correctedDistanceM;
      continue;
    }

    if (entry.mesgNum === MESG_NUM.lap || entry.mesgNum === MESG_NUM.session) {
      applyRangeSummary(entry.message, records);
      continue;
    }

    if (entry.mesgNum === MESG_NUM.activity) {
      const durationSeconds = Math.max(
        (records[records.length - 1].timestampMs - records[0].timestampMs) / 1000,
        0
      );
      if ("totalTimerTime" in entry.message) {
        entry.message.totalTimerTime = durationSeconds;
      }
    }
  }
};

const encodeMessages = (
  messages: OrderedMessage[],
  fieldDescriptions: Record<string, { developerDataIdMesg: unknown; fieldDescriptionMesg: unknown }>
): Uint8Array => {
  const encoder = new Encoder({ fieldDescriptions });

  for (const message of messages) {
    encoder.onMesg(message.mesgNum, message.message);
  }

  return encoder.close();
};

const fitDistanceFromSeries = (records: RecordState[]): number | null => {
  const first = records.find((record) => record.originalDistanceM !== null);
  const last = [...records].reverse().find((record) => record.originalDistanceM !== null);

  if (!first || !last || first.originalDistanceM === null || last.originalDistanceM === null) {
    return null;
  }

  if (last.originalDistanceM < first.originalDistanceM) {
    return null;
  }

  return last.originalDistanceM - first.originalDistanceM;
};

export const correctFitActivity = (
  fitBytes: Uint8Array,
  segments: WorkoutSegment[]
): FitCorrectionResult => {
  if (segments.length === 0) {
    throw new Error("Workout prescription is empty. Add at least one step.");
  }

  const decoded = decodeMessages(fitBytes);
  const messages = decoded.messages;

  const records = collectRecordStates(messages, segments);
  patchMessages(messages, records);

  const messagesWithWorkout = injectWorkoutMessages(messages, segments, records);
  const correctedFitBytes = encodeMessages(messagesWithWorkout, decoded.fieldDescriptions);

  const firstDistance = records[0].correctedDistanceM;
  const lastDistance = records[records.length - 1].correctedDistanceM;
  const correctedDistanceMeters = Math.max(lastDistance - firstDistance, 0);

  const originalDistanceMeters =
    fitDistanceFromSeries(records) ?? computeIntegratedOriginalDistance(records);

  const durationSeconds = Math.max(
    (records[records.length - 1].timestampMs - records[0].timestampMs) / 1000,
    0
  );

  const maxOriginalSpeedMps = records.reduce(
    (max, item) => (item.originalSpeedMps > max ? item.originalSpeedMps : max),
    0
  );

  const maxCorrectedSpeedMps = records.reduce(
    (max, item) => (item.correctedSpeedMps > max ? item.correctedSpeedMps : max),
    0
  );

  const summary: CorrectionSummary = {
    durationSeconds,
    originalDistanceKm: originalDistanceMeters / 1000,
    correctedDistanceKm: correctedDistanceMeters / 1000,
    originalAvgSpeedKmh: durationSeconds > 0 ? (originalDistanceMeters / durationSeconds) * 3.6 : 0,
    correctedAvgSpeedKmh: durationSeconds > 0 ? (correctedDistanceMeters / durationSeconds) * 3.6 : 0,
    maxOriginalSpeedKmh: maxOriginalSpeedMps * 3.6,
    maxCorrectedSpeedKmh: maxCorrectedSpeedMps * 3.6,
    recordsCount: records.length,
  };

  return {
    correctedFitBytes,
    points: buildPreviewPoints(records),
    summary,
  };
};
