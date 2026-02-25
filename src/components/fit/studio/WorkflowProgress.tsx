import { CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStep } from "@/components/fit/studio/types";

type WorkflowProgressProps = {
  steps: WorkflowStep[];
};

export function WorkflowProgress({ steps }: WorkflowProgressProps) {
  return (
    <ol className="mt-5 flex flex-wrap items-center gap-y-2" aria-label="Workflow progress">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-center">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors",
              step.state === "done" && "border-primary/70 bg-primary/10 text-primary",
              step.state === "active" && "border-sky-300/45 bg-sky-400/10 text-sky-100",
              step.state === "idle" && "border-border/80 bg-card/60 text-muted-foreground"
            )}
          >
            {step.state === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : step.state === "active" ? (
              <CircleDashed className="h-3.5 w-3.5 animate-spin-slow" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            {step.label}
          </span>

          {index < steps.length - 1 ? (
            <span className={cn("mx-2 h-px w-7", step.state === "done" ? "bg-primary/60" : "bg-border/80")} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
