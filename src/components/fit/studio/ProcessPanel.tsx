import { Download, LoaderCircle, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/fit/studio/StatusBanner";
import type { StatusTone } from "@/components/fit/studio/types";

type ProcessPanelProps = {
  isProcessing: boolean;
  canProcess: boolean;
  hasResult: boolean;
  onProcess: () => void;
  onDownload: () => void;
  status: {
    tone: StatusTone;
    title: string;
    message: string;
  };
};

export function ProcessPanel({
  isProcessing,
  canProcess,
  hasResult,
  onProcess,
  onDownload,
  status,
}: ProcessPanelProps) {
  return (
    <div className="panel p-5 md:p-6" id="pipeline">
      <h2 className="section-title">3. Process and Export</h2>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          The correction engine rewrites <code>speed</code>/<code>enhancedSpeed</code> and <code>distance</code> for
          every record, then recalculates lap, session, and activity totals.
        </p>
        <p>Heart rate, cadence, and the remaining metrics are preserved from the original file.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onProcess} disabled={isProcessing || !canProcess}>
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

        {hasResult ? (
          <Button variant="secondary" onClick={onDownload} className="micro-pop">
            <Download className="mr-2 h-4 w-4" /> Download corrected FIT
          </Button>
        ) : null}
      </div>

      <StatusBanner tone={status.tone} title={status.title} message={status.message} />
    </div>
  );
}
