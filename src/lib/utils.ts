import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "-";
  return `${distanceKm.toFixed(distanceKm >= 10 ? 1 : 2)} km`;
}

export function formatSpeed(speedKmh: number): string {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return "-";
  return `${speedKmh.toFixed(1)} km/h`;
}

export function formatPace(speedKmh: number): string {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return "-";
  const totalSeconds = 3600 / speedKmh;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  const carryMinutes = seconds === 60 ? 1 : 0;
  const safeSeconds = seconds === 60 ? 0 : seconds;
  return `${minutes + carryMinutes}:${safeSeconds.toString().padStart(2, "0")} /km`;
}

export function formatPaceInput(speedKmh: number): string {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return "";
  const totalSeconds = 3600 / speedKmh;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  const carryMinutes = seconds === 60 ? 1 : 0;
  const safeSeconds = seconds === 60 ? 0 : seconds;
  return `${minutes + carryMinutes}:${safeSeconds.toString().padStart(2, "0")}`;
}

export function parsePaceInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{1,2})\s*:\s*([0-5]?\d(?:\.\d+)?)(?:\s*\/\s*km)?$/i);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds <= 0) return null;

  return 3600 / totalSeconds;
}
