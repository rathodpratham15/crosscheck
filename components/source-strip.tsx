"use client";

import type { Source } from "@/lib/tavily";
import type { CitationStatus } from "./citation-chip";

type SourceStripProps = {
  sources: Source[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  getStatus?: (id: number) => CitationStatus | undefined;
};

const STATUS_DOT: Record<CitationStatus, string> = {
  checking: "bg-zinc-400 animate-pulse",
  verified: "bg-emerald-500",
  unsupported: "bg-amber-500",
};

export function SourceStrip({
  sources,
  selectedId,
  onSelect,
  getStatus,
}: SourceStripProps) {
  if (sources.length === 0) return null;

  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-zinc-200 px-4 pb-3 dark:border-zinc-800">
      {sources.map((s) => {
        const isSelected = s.id === selectedId;
        const status = getStatus?.(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors " +
              (isSelected
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900")
            }
            title={s.title}
          >
            <span
              className={
                "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold " +
                (isSelected
                  ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")
              }
            >
              {s.id}
            </span>
            <span className="max-w-48 truncate">{s.title}</span>
            {status && (
              <span
                aria-label={`verification ${status}`}
                className={"h-1.5 w-1.5 shrink-0 rounded-full " + STATUS_DOT[status]}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
