import { describe, expect, it } from "vitest";
import {
  distanceMetersBetweenElapsedSeconds,
  normalizeBuilderSegments,
  parseIntervalsNotation,
  serializeIntervalsNotation,
  speedAtElapsedSeconds,
} from "./prescription";

describe("parseIntervalsNotation", () => {
  it("parses repetitions, names and pace notation", () => {
    const segments = parseIntervalsNotation(
      "2x(45s@3:40/km{Rep},15s@0.1km/h{Recovery})"
    );

    expect(segments).toHaveLength(4);
    expect(segments[0].name).toBe("Rep");
    expect(segments[0].durationSeconds).toBe(45);
    expect(segments[0].speedKmh).toBeCloseTo(16.3636, 3);
    expect(segments[1].name).toBe("Recovery");
    expect(segments[1].speedKmh).toBeCloseTo(0.1, 6);
  });

  it("parses km/h, m/s and mph units", () => {
    const segments = parseIntervalsNotation("60s@10km/h,60s@4m/s,60s@6mph");

    expect(segments[0].speedKmh).toBeCloseTo(10, 6);
    expect(segments[1].speedKmh).toBeCloseTo(14.4, 6);
    expect(segments[2].speedKmh).toBeCloseTo(9.656064, 6);
  });
});

describe("serializeIntervalsNotation", () => {
  it("serializes segments with names into normalized notation", () => {
    const segments = parseIntervalsNotation("2m@14km/h{Fast},1m@8km/h{Easy}");
    const notation = serializeIntervalsNotation(segments);
    expect(notation).toBe("2m@14km/h{Fast}, 1m@8km/h{Easy}");
  });
});

describe("workout math", () => {
  it("prefers the faster segment at exact boundaries", () => {
    const segments = parseIntervalsNotation("10s@8km/h,10s@16km/h");
    expect(speedAtElapsedSeconds(segments, 10)).toBeCloseTo(16, 6);
  });

  it("keeps the last speed after workout end when integrating distance", () => {
    const segments = parseIntervalsNotation("10s@18km/h");
    const distance = distanceMetersBetweenElapsedSeconds(segments, 0, 20);
    expect(distance).toBeCloseTo(100, 3);
  });

  it("validates invalid builder values", () => {
    expect(() =>
      normalizeBuilderSegments([{ duration: 0, unit: "m", speedKmh: 10 }])
    ).toThrowError();
  });
});
