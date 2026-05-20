"use client";

import { CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";
import type { Source } from "@/lib/tavily";
import type { CitationStatus } from "./citation-chip";

const DOMAIN_META = {
  arxiv: { short: "arXiv" },
  semanticscholar: { short: "S2" },
  paperswithcode: { short: "PwC" },
  github: { short: "GitHub" },
  other: { short: "Web" },
} as const;

function getDomain(url: string) {
  if (url.includes("arxiv.org")) return DOMAIN_META.arxiv;
  if (url.includes("semanticscholar.org")) return DOMAIN_META.semanticscholar;
  if (url.includes("paperswithcode.com")) return DOMAIN_META.paperswithcode;
  if (url.includes("github.com")) return DOMAIN_META.github;
  return DOMAIN_META.other;
}

function extractYear(url: string): number | null {
  const m = url.match(/arxiv\.org\/abs\/(\d{2})\d{2}\./);
  if (m) {
    const y = parseInt(m[1]);
    return (y <= 30 ? 2000 : 1900) + y;
  }
  return null;
}

function VerifIcon({ status }: { status: CitationStatus }) {
  if (status === "verified")
    return (
      <CheckCircle2
        className="h-3 w-3"
        strokeWidth={2.25}
        style={{ color: "var(--color-verified)" }}
        aria-label="verified"
      />
    );
  if (status === "unsupported")
    return (
      <AlertTriangle
        className="h-3 w-3"
        strokeWidth={2.25}
        style={{ color: "var(--color-unsupported)" }}
        aria-label="unsupported"
      />
    );
  return (
    <CircleDashed
      className="h-3 w-3 dot-pulse"
      strokeWidth={2.25}
      style={{ color: "var(--color-checking)" }}
      aria-label="checking"
    />
  );
}

export function SourcePill({
  source,
  verification,
  onClick,
  index,
}: {
  source: Source;
  verification?: CitationStatus;
  onClick?: () => void;
  index: number;
}) {
  const dm = getDomain(source.url);
  const year = extractYear(source.url);

  return (
    <button
      type="button"
      onClick={onClick}
      title={source.title}
      className="group flex w-[260px] shrink-0 items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3 text-left transition-all hover:-translate-y-px hover:border-[var(--color-line-strong)] hover:bg-[var(--color-ink-2)]"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-ink-2)] font-mono text-[10px] text-[var(--color-text-secondary)]">
        {source.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-[var(--color-fg)] group-hover:text-white">
          {source.title}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[10.5px] text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-ink-2)] px-1.5 py-0.5 font-mono uppercase tracking-wider">
            {dm.short}
          </span>
          {year && <span className="font-mono">{year}</span>}
          {verification && (
            <span className="ml-auto inline-flex items-center gap-1">
              <VerifIcon status={verification} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function NewSourceStrip({
  sources,
  getVerification,
  onOpen,
}: {
  sources: Source[];
  getVerification?: (id: number) => CitationStatus | undefined;
  onOpen: (id: number) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
      {sources.map((s, i) => (
        <SourcePill
          key={s.id}
          source={s}
          verification={getVerification?.(s.id)}
          index={i}
          onClick={() => onOpen(s.id)}
        />
      ))}
    </div>
  );
}
