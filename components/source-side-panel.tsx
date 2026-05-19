"use client";

import { useEffect, useState } from "react";
import type { PaperDetails } from "@/app/api/paper-details/route";
import type { Source } from "@/lib/tavily";
import type { CitationStatus } from "./citation-chip";

export type VerificationDisplay = {
  status: CitationStatus;
  reason?: string;
  quote?: string;
};

type SourceSidePanelProps = {
  source: Source | null;
  verification?: VerificationDisplay;
  onClose: () => void;
};

export function SourceSidePanel({
  source,
  verification,
  onClose,
}: SourceSidePanelProps) {
  const [displayed, setDisplayed] = useState<Source | null>(source);
  if (source && source !== displayed) {
    setDisplayed(source);
  }

  const [paperDetails, setPaperDetails] = useState<PaperDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!source) return;
    setDetailsLoading(true);
    setPaperDetails(null);
    void fetch(`/api/paper-details?url=${encodeURIComponent(source.url)}`)
      .then((r) => r.json() as Promise<PaperDetails | null>)
      .then((data) => setPaperDetails(data))
      .catch(() => {})
      .finally(() => setDetailsLoading(false));
  }, [source?.url]);

  useEffect(() => {
    if (source) return;
    const t = setTimeout(() => setDisplayed(null), 300);
    return () => clearTimeout(t);
  }, [source]);

  useEffect(() => {
    if (!source) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, onClose]);

  const isOpen = source !== null;

  if (!displayed) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 " +
          (isOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        className={
          // Base
          "fixed z-50 overflow-y-auto border-zinc-200 bg-white p-6 shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950 " +
          // Mobile: bottom sheet sliding up
          "bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-2xl border-t " +
          // Desktop: side panel sliding in from right
          "md:bottom-auto md:top-0 md:left-auto md:right-0 md:h-full md:w-full md:max-w-md md:max-h-none md:rounded-none md:border-l md:border-t-0 " +
          // Open/closed transform — mobile: translateY, desktop: translateX
          (isOpen
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full")
        }
      >
        {/* Drag handle — mobile only */}
        <div className="mb-4 flex justify-center md:hidden" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </div>

        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold dark:bg-zinc-800">
              {displayed.id}
            </span>
            <h2 className="text-sm font-semibold leading-5">{displayed.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source panel"
            className="-mt-1 -mr-2 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            ✕
          </button>
        </header>

        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="break-all text-xs text-zinc-500">{displayed.url}</p>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs tabular-nums text-zinc-500 dark:bg-zinc-800">
            {Math.round(displayed.score * 100)}% match
          </span>
        </div>

        {detailsLoading && (
          <div className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
            Loading paper details…
          </div>
        )}
        {paperDetails && (paperDetails.authors.length > 0 || paperDetails.year) && (
          <p className="mb-3 text-xs text-zinc-500">
            {paperDetails.authors.length > 0 && (
              <span>
                {paperDetails.authors.join(", ")}
                {paperDetails.authors.length === 4 ? " et al." : ""}
              </span>
            )}
            {paperDetails.year && (
              <span className="ml-1 text-zinc-400">· {paperDetails.year}</span>
            )}
          </p>
        )}
        {paperDetails?.abstract && (
          <div className="mb-4 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Abstract
            </p>
            <p className="line-clamp-6">{paperDetails.abstract}</p>
          </div>
        )}

        {verification && <VerificationBanner verification={verification} />}

        <p className="mb-6 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {displayed.snippet}
        </p>

        <a
          href={displayed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Open original ↗
        </a>
      </aside>
    </>
  );
}

function VerificationBanner({
  verification,
}: {
  verification: VerificationDisplay;
}) {
  if (verification.status === "checking") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
        Verifying citation against source…
      </div>
    );
  }
  if (verification.status === "verified") {
    return (
      <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Verified
        </div>
        {verification.reason && (
          <p className="leading-5 opacity-90">{verification.reason}</p>
        )}
        {verification.quote && (
          <blockquote className="mt-2 border-l-2 border-emerald-400 pl-2 italic opacity-80">
            "{verification.quote}"
          </blockquote>
        )}
      </div>
    );
  }
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Unsupported
      </div>
      {verification.reason && (
        <p className="leading-5 opacity-90">{verification.reason}</p>
      )}
    </div>
  );
}
