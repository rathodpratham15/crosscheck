"use client";

import { ArrowUpRight, Clock } from "lucide-react";

export function EmptyState({
  examples,
  recent,
  onPick,
}: {
  examples: string[];
  recent: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          Try an example
        </div>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex, i) => (
            <button
              key={ex}
              type="button"
              onClick={() => onPick(ex)}
              data-testid={`example-prompt-${i}`}
              className="group inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-text-secondary)] transition-colors hover:border-indigo-500/40 hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
            >
              <span>{ex}</span>
              <ArrowUpRight
                className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={2}
              />
            </button>
          ))}
        </div>
      </div>
      {recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <Clock className="h-3 w-3" strokeWidth={1.75} />
            <span>Recent</span>
          </div>
          <ul className="space-y-1.5">
            {recent.map((r, i) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  data-testid={`recent-${i}`}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[12.5px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
