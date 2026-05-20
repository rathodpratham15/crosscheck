"use client";

export type DomainFilter =
  | "all"
  | "arxiv"
  | "semanticscholar"
  | "paperswithcode"
  | "github";

const DOMAIN_LABELS: Record<Exclude<DomainFilter, "all">, string> = {
  arxiv: "arXiv",
  semanticscholar: "S2",
  paperswithcode: "PwC",
  github: "GitHub",
};

export function DomainFilters({
  active,
  onChange,
  counts,
}: {
  active: DomainFilter;
  onChange: (d: DomainFilter) => void;
  counts: Partial<Record<DomainFilter, number>> & { all: number };
}) {
  const items: { key: DomainFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...Object.entries(DOMAIN_LABELS)
      .filter(([k]) => (counts[k as DomainFilter] ?? 0) > 0)
      .map(([k, label]) => ({ key: k as DomainFilter, label })),
  ];

  // Only render if there are multiple distinct domains
  if (items.length <= 2) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        Sources
      </span>
      {items.map((it) => {
        const isActive = active === it.key;
        const count = counts[it.key as keyof typeof counts] ?? 0;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition-colors ${
              isActive
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
            }`}
          >
            <span className="font-mono">{it.label}</span>
            <span
              className={`rounded-sm px-1 font-mono text-[10px] ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-200"
                  : "bg-[var(--color-ink-2)] text-[var(--color-text-muted)]"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
