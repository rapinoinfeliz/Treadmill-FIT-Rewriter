import { WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatKm, formatPace, formatSpeed } from "@/lib/utils";
import type { StudioResult } from "@/components/fit/studio/types";

type SessionSummaryPanelProps = {
  result: StudioResult | null;
};

export function SessionSummaryPanel({ result }: SessionSummaryPanelProps) {
  return (
    <div className="panel p-5 md:p-6">
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
          <Metric
            label="Original Avg"
            value={`${formatSpeed(result.summary.originalAvgSpeedKmh)} • ${formatPace(result.summary.originalAvgSpeedKmh)}`}
          />
          <Metric
            label="Corrected Avg"
            value={`${formatSpeed(result.summary.correctedAvgSpeedKmh)} • ${formatPace(result.summary.correctedAvgSpeedKmh)}`}
          />
          <Metric
            label="Original Peak"
            value={`${formatSpeed(result.summary.maxOriginalSpeedKmh)} • ${formatPace(result.summary.maxOriginalSpeedKmh)}`}
          />
          <Metric
            label="Corrected Peak"
            value={`${formatSpeed(result.summary.maxCorrectedSpeedKmh)} • ${formatPace(result.summary.maxCorrectedSpeedKmh)}`}
          />
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
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-soft p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground md:text-lg">{value}</p>
    </div>
  );
}
