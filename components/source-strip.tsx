"use client";

import { useRef } from "react";
import type { Source } from "@/lib/tavily";
import type { CitationStatus } from "./citation-chip";

function extractYear(url: string): number | null {
  const m = url.match(/arxiv\.org\/abs\/(\d{2})\d{2}\./);
  if (m) {
    const y = parseInt(m[1]);
    return (y <= 30 ? 2000 : 1900) + y;
  }
  return null;
}

const CURRENT_YEAR = new Date().getFullYear();

type SourceStripProps = {
  sources: Source[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  getStatus?: (id: number) => CitationStatus | undefined;
};

const STATUS_BADGE: Record<CitationStatus, { bg: string; symbol: string }> = {
  checking: { bg: "bg-zinc-400 animate-pulse", symbol: "" },
  verified: { bg: "bg-emerald-500", symbol: "✓" },
  unsupported: { bg: "bg-amber-500", symbol: "!" },
};

export function SourceStrip({
  sources,
  selectedId,
  onSelect,
  getStatus,
}: SourceStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  if (sources.length === 0) return null;

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const buttons =
      stripRef.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!buttons) return;
    const next =
      e.key === "ArrowRight"
        ? Math.min(idx + 1, buttons.length - 1)
        : Math.max(idx - 1, 0);
    buttons[next]?.focus();
  }

  return (
    <div
      ref={stripRef}
      role="toolbar"
      aria-label="Sources"
      className="-mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-zinc-200 px-4 pb-3 scrollbar-none [&::-webkit-scrollbar]:hidden dark:border-zinc-800"
    >
      {sources.map((s, idx) => {
        const isSelected = s.id === selectedId;
        const status = getStatus?.(s.id);
        const year = extractYear(s.url);
        const isStale = year !== null && CURRENT_YEAR - year > 3;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
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
            <span className="max-w-32 truncate">{s.title}</span>
            <span
              className={
                "shrink-0 tabular-nums text-[10px] " +
                (isSelected
                  ? "text-white/70 dark:text-zinc-900/70"
                  : "text-zinc-400 dark:text-zinc-500")
              }
            >
              {Math.round(s.score * 100)}%
            </span>
            {year !== null && (
              <span
                title={isStale ? `Published ${year} — may be outdated` : `Published ${year}`}
                className={
                  "shrink-0 rounded px-1 text-[9px] font-medium tabular-nums " +
                  (isStale
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    : isSelected
                      ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")
                }
              >
                {year}
              </span>
            )}
            {status && (
              <span
                aria-label={`verification ${status}`}
                className={
                  "flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[8px] leading-none font-bold text-white " +
                  STATUS_BADGE[status].bg
                }
              >
                {STATUS_BADGE[status].symbol}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
