import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/components/fit/studio/types";

type StatusBannerProps = {
  tone: StatusTone;
  title: string;
  message: string;
};

export function StatusBanner({ tone, title, message }: StatusBannerProps) {
  return (
    <div
      className={cn(
        "status-banner mt-4 flex items-start gap-3 rounded-lg border px-3 py-2.5",
        tone === "idle" && "border-border/80 bg-card/55",
        tone === "working" && "border-sky-300/35 bg-sky-400/10",
        tone === "success" && "border-emerald-300/35 bg-emerald-400/10 micro-pop",
        tone === "error" && "border-red-300/40 bg-red-400/10"
      )}
      data-tone={tone}
    >
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border",
          tone === "idle" && "border-border/90 bg-card/70 text-muted-foreground",
          tone === "working" && "border-sky-300/40 bg-sky-400/15 text-sky-100",
          tone === "success" && "border-emerald-300/45 bg-emerald-400/20 text-emerald-100",
          tone === "error" && "border-red-300/45 bg-red-400/20 text-red-100"
        )}
      >
        {tone === "working" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : tone === "success" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : tone === "error" ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
