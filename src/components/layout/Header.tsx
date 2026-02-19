import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/90 px-5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 md:px-7">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Workout Forge</p>
        <h1 className="text-sm font-semibold text-foreground md:text-base">FIT Treadmill Correction Studio</h1>
      </div>
      <Badge variant="secondary" className="font-mono text-[11px] tracking-wide">
        speed + distance rewrite
      </Badge>
    </header>
  );
}
