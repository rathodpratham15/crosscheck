"use client";

export type CitationStatus = "checking" | "verified" | "unsupported";

type CitationChipProps = {
  n: number;
  status?: CitationStatus;
  onClick?: () => void;
};

const STATUS_DOT: Record<CitationStatus, string> = {
  checking: "bg-zinc-400 animate-pulse",
  verified: "bg-emerald-500",
  unsupported: "bg-amber-500",
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
            "pointer-events-none absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-zinc-950 " +
            STATUS_DOT[status]
          }
        />
      )}
    </span>
  );
}
