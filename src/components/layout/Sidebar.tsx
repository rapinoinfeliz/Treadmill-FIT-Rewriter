"use client";

import Link from "next/link";
import { ActivitySquare, Binary, FileCog, Gauge, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Studio", icon: FileCog, href: "#studio" },
  { label: "Workout Input", icon: Binary, href: "#parser" },
  { label: "Preview", icon: Gauge, href: "#preview" },
  { label: "Processing", icon: Workflow, href: "#pipeline" },
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "w-72 min-h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      <div className="space-y-5 px-4 py-5">
        <div className="rounded-xl border border-sidebar-border bg-black/20 px-3 py-4">
          <div className="mb-2 flex items-center gap-2 text-sidebar-primary">
            <ActivitySquare className="h-5 w-5" />
            <span className="text-base font-semibold">Treadmill Corrector</span>
          </div>
          <p className="text-xs leading-relaxed text-sidebar-foreground/75">
            Ingest, correct, and re-encode FIT sessions while preserving heart rate and cadence data.
          </p>
        </div>

        <nav className="space-y-1.5">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
