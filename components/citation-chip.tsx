"use client";

type CitationChipProps = {
  n: number;
  onClick?: () => void;
};

export function CitationChip({ n, onClick }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Citation ${n}`}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-100 px-1.5 align-middle text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {n}
    </button>
  );
}
