"use client";

import type { Source } from "@/lib/tavily";

type SourceStripProps = {
  sources: Source[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function SourceStrip({ sources, selectedId, onSelect }: SourceStripProps) {
  if (sources.length === 0) return null;

  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-zinc-200 px-4 pb-3 dark:border-zinc-800">
      {sources.map((s) => {
        const isSelected = s.id === selectedId;
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
            <span className="max-w-[12rem] truncate">{s.title}</span>
          </button>
        );
      })}
    </div>
  );
}
