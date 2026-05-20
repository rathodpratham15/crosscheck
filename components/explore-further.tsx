"use client";

import { Compass } from "lucide-react";

export function ExploreFurther({
  items,
  onPick,
}: {
  items: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        <Compass className="h-3 w-3" strokeWidth={1.75} />
        <span>Explore further</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <button
            key={it}
            type="button"
            onClick={() => onPick(it)}
            data-testid={`explore-pill-${i}`}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] transition-colors hover:border-indigo-500/40 hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
          >
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}
