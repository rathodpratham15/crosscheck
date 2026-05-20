"use client";

import { useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  ExternalLink,
  Quote,
} from "lucide-react";
import type { Source } from "@/lib/tavily";
import type { VerificationDisplay } from "./source-side-panel";

const DOMAIN_META = {
  arxiv: { label: "arXiv", short: "arXiv" },
  semanticscholar: { label: "Semantic Scholar", short: "S2" },
  paperswithcode: { label: "Papers with Code", short: "PwC" },
  github: { label: "GitHub", short: "GitHub" },
  other: { label: "Web", short: "Web" },
} as const;

function getDomainMeta(url: string) {
  if (url.includes("arxiv.org")) return DOMAIN_META.arxiv;
  if (url.includes("semanticscholar.org")) return DOMAIN_META.semanticscholar;
  if (url.includes("paperswithcode.com")) return DOMAIN_META.paperswithcode;
  if (url.includes("github.com")) return DOMAIN_META.github;
  return DOMAIN_META.other;
}

const VERIF_META = {
  verified: {
    icon: CheckCircle2,
    label: "Verified citation",
    sub: "This excerpt was located in the source document.",
    color: "#10B981",
  },
  unsupported: {
    icon: AlertTriangle,
    label: "Unsupported claim",
    sub: "The excerpt could not be matched against the source.",
    color: "#EF4444",
  },
  checking: {
    icon: CircleDashed,
    label: "Verification in progress",
    sub: "We are still cross-checking this citation.",
    color: "#F59E0B",
  },
} as const;

export function SourceDetail({
  source,
  verification,
  onClose,
}: {
  source: Source | null;
  verification?: VerificationDisplay;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, onClose]);

  if (!source) return null;

  const dm = getDomainMeta(source.url);
  const verifStatus = verification?.status ?? "checking";
  const meta = VERIF_META[verifStatus];
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Desktop slide-over */}
      <aside className="slide-in absolute right-0 top-0 hidden h-full w-full max-w-[520px] flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl shadow-black/50 md:flex">
        <PanelInner
          source={source}
          verification={verification}
          onClose={onClose}
          Icon={Icon}
          meta={meta}
          dm={dm}
        />
      </aside>

      {/* Mobile bottom sheet */}
      <aside className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-bg-elev)] md:hidden">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--color-line-strong)]" />
        <PanelInner
          source={source}
          verification={verification}
          onClose={onClose}
          Icon={Icon}
          meta={meta}
          dm={dm}
        />
      </aside>
    </div>
  );
}

function PanelInner({
  source,
  verification,
  onClose,
  Icon,
  meta,
  dm,
}: {
  source: Source;
  verification?: VerificationDisplay;
  onClose: () => void;
  Icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    style?: React.CSSProperties;
  }>;
  meta: { label: string; sub: string; color: string };
  dm: { label: string; short: string };
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center rounded-sm border border-[var(--color-border)] bg-[var(--color-ink-2)] px-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            {dm.short}
          </span>
          <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
            #{source.id}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
        {verification && (
          <div
            className="mb-5 flex items-start gap-3 rounded-lg border p-3"
            style={{
              borderColor: `${meta.color}33`,
              background: `${meta.color}14`,
            }}
          >
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={2}
              style={{ color: meta.color }}
            />
            <div className="min-w-0">
              <div
                className="text-[13px] font-semibold"
                style={{ color: meta.color }}
              >
                {meta.label}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[var(--color-text-secondary)]">
                {meta.sub}
              </div>
            </div>
          </div>
        )}

        <h2 className="font-heading text-[20px] font-semibold leading-snug tracking-tight text-[var(--color-fg)]">
          {source.title}
        </h2>

        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 break-all rounded-md border border-[var(--color-border)] bg-[var(--color-ink-2)] px-2.5 py-1.5 font-mono text-[11.5px] text-indigo-300 transition-colors hover:bg-[var(--color-ink-3)]"
        >
          <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={2} />
          <span className="truncate">{source.url}</span>
        </a>

        <section className="mt-6">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Snippet
          </h3>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
            {source.snippet}
          </p>
        </section>

        {verification?.quote && (
          <section className="mt-6">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Verified excerpt
            </h3>
            <blockquote className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-ink-2)] p-4">
              <Quote
                className="absolute left-2 top-2 h-3 w-3 opacity-50"
                strokeWidth={1.75}
                style={{ color: meta.color }}
              />
              <p className="pl-4 font-mono text-[12.5px] leading-relaxed text-[var(--color-fg)]">
                {verification.quote}
              </p>
            </blockquote>
          </section>
        )}

        {verification?.reason && (
          <section className="mt-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Reason
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {verification.reason}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
