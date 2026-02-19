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
