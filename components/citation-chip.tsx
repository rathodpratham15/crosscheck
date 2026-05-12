"use client";

export type CitationStatus = "checking" | "verified" | "unsupported";

type CitationChipProps = {
  n: number;
  status?: CitationStatus;
  onClick?: () => void;
};

const STATUS_BADGE: Record<CitationStatus, { bg: string; symbol: string }> = {
  checking: { bg: "bg-zinc-400 animate-pulse", symbol: "" },
  verified: { bg: "bg-emerald-500", symbol: "✓" },
  unsupported: { bg: "bg-amber-500", symbol: "!" },
};

export function CitationChip({ n, status, onClick }: CitationChipProps) {
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={onClick}
        aria-label={
          status
            ? `Citation ${n}, ${status}`
            : `Citation ${n}`
        }
        className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {n}
      </button>
      {status && (
        <span
          aria-hidden="true"
          className={
            "pointer-events-none absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-[8px] leading-none font-bold text-white ring-2 ring-white dark:ring-zinc-950 " +
            STATUS_BADGE[status].bg
          }
        >
          {STATUS_BADGE[status].symbol}
        </span>
      )}
    </span>
  );
}
