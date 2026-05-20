"use client";

import { useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Share2,
  FileCode2,
  FileText,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import type { Source } from "@/lib/tavily";
import type { VerificationDisplay } from "./source-side-panel";
import type { CitationStatus } from "./citation-chip";
import { MarkdownAnswer } from "./markdown-answer";
import { NewSourceStrip } from "./source-pill";
import { DomainFilters, type DomainFilter } from "./domain-filters";

const MODEL_ACCENT: Record<"claude" | "gpt" | "gemini", string> = {
  claude: "var(--color-claude)",
  gpt: "var(--color-gpt)",
  gemini: "var(--color-gemini)",
};

const MODEL_LABEL: Record<"claude" | "gpt" | "gemini", string> = {
  claude: "Claude Sonnet",
  gpt: "GPT-4o mini",
  gemini: "Gemini 2.0 Flash",
};

function getDomainKey(url: string): DomainFilter {
  if (url.includes("arxiv.org")) return "arxiv";
  if (url.includes("semanticscholar.org")) return "semanticscholar";
  if (url.includes("paperswithcode.com")) return "paperswithcode";
  if (url.includes("github.com")) return "github";
  return "all";
}

function generateBibtex(sources: Source[], answer: string): string {
  const cited = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) cited.add(Number(m[1]));
  return sources
    .filter((s) => cited.has(s.id))
    .map((s) => {
      const title = s.title.replace(/[{}]/g, "");
      return `@misc{crosscheck${s.id},\n  title = {${title}},\n  url   = {${s.url}},\n  note  = {Accessed via crosscheck}\n}`;
    })
    .join("\n\n");
}

function downloadAs(ext: string, name: string, body: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([body], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

type ResultCardProps = {
  model: "claude" | "gpt" | "gemini";
  answer: string;
  sources: Source[];
  verifications: Record<number, VerificationDisplay>;
  isPrimary?: boolean;
  isStreaming?: boolean;
  isSaved?: boolean;
  onSave?: () => void;
  onShare?: () => void;
  onSelectSource: (id: number) => void;
  onRunGpt?: () => void;
  onRunGemini?: () => void;
  gptDone?: boolean;
  geminiDone?: boolean;
  cachedResult?: boolean;
  onRerun?: () => void;
  query: string;
};

export function ResultCard({
  model,
  answer,
  sources,
  verifications,
  isPrimary,
  isStreaming,
  isSaved,
  onSave,
  onShare,
  onSelectSource,
  onRunGpt,
  onRunGemini,
  gptDone,
  geminiDone,
  cachedResult,
  onRerun,
  query,
}: ResultCardProps) {
  const [filter, setFilter] = useState<DomainFilter>("all");
  const [collapsed, setCollapsed] = useState(false);

  const getVerification = (id: number): CitationStatus | undefined =>
    verifications[id]?.status;

  const filteredSources = useMemo(() => {
    if (filter === "all") return sources;
    return sources.filter((s) => getDomainKey(s.url) === filter);
  }, [sources, filter]);

  const counts = useMemo(() => {
    const c: Partial<Record<DomainFilter, number>> & { all: number } = {
      all: sources.length,
    };
    sources.forEach((s) => {
      const d = getDomainKey(s.url);
      if (d !== "all") c[d] = (c[d] ?? 0) + 1;
    });
    return c;
  }, [sources]);

  const confidenceScore = useMemo(() => {
    const vals = Object.values(verifications);
    const checked = vals.filter((v) => v.status !== "checking").length;
    const verified = vals.filter((v) => v.status === "verified").length;
    return checked > 0 ? Math.round((verified / checked) * 100) : null;
  }, [verifications]);

  const accent = MODEL_ACCENT[model];
  const label = MODEL_LABEL[model];
  const hasBibtex =
    answer.length > 0 && /\[\d+\]/.test(answer) && sources.length > 0;

  const confColor =
    confidenceScore === null
      ? "#818CF8"
      : confidenceScore >= 80
        ? "#10B981"
        : confidenceScore >= 60
          ? "#F59E0B"
          : "#EF4444";

  return (
    <article
      className="fade-up relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]"
      style={{ borderLeftWidth: 2, borderLeftColor: accent }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
        <span
          className="inline-flex h-2 w-2 rounded-full"
          style={{ background: accent }}
        />
        <span className="font-heading text-[13px] font-semibold tracking-tight text-[var(--color-fg)]">
          {label}
        </span>
        {confidenceScore !== null && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10.5px]"
            style={{
              borderColor: `${confColor}40`,
              background: `${confColor}14`,
              color: confColor,
            }}
          >
            <span className="font-mono font-medium">{confidenceScore}%</span>
            <span>verified</span>
          </span>
        )}
        {!isPrimary && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
              strokeWidth={2}
            />
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Sources */}
          {sources.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <DomainFilters
                  active={filter}
                  onChange={setFilter}
                  counts={counts}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {filteredSources.length} sources
                </span>
              </div>
              <NewSourceStrip
                sources={filteredSources}
                getVerification={getVerification}
                onOpen={onSelectSource}
              />
            </div>
          )}

          {/* Answer body */}
          {answer ? (
            <div className="px-5 py-5 md:px-7 md:py-6">
              <MarkdownAnswer
                text={answer}
                sources={sources}
                getVerification={getVerification}
                onCite={onSelectSource}
              />
            </div>
          ) : isStreaming && sources.length > 0 ? (
            <div className="space-y-2 px-5 py-5 md:px-7 md:py-6">
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-ink-4)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--color-ink-4)]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--color-ink-4)]" />
              <div className="mt-1 h-3 w-full animate-pulse rounded bg-[var(--color-ink-4)]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-ink-4)]" />
            </div>
          ) : null}

          {/* Footer */}
          {!isStreaming && (answer || sources.length > 0) && (
            <div className="flex flex-wrap items-center gap-1 border-t border-[var(--color-border)] px-3 py-2">
              {isPrimary && (
                <div className="flex items-center gap-1">
                  {!gptDone && onRunGpt && (
                    <ModelTrigger
                      label="Compare GPT-4o mini →"
                      color="var(--color-gpt)"
                      onClick={onRunGpt}
                    />
                  )}
                  {!geminiDone && onRunGemini && (
                    <ModelTrigger
                      label="Compare Gemini 2.0 →"
                      color="var(--color-gemini)"
                      onClick={onRunGemini}
                    />
                  )}
                  {cachedResult && onRerun && (
                    <ActionBtn
                      label="Re-run"
                      Icon={RotateCcw}
                      onClick={onRerun}
                    />
                  )}
                </div>
              )}
              <div className="ml-auto flex items-center gap-1">
                {onSave && (
                  <ActionBtn
                    label={isSaved ? "Saved" : "Save"}
                    Icon={isSaved ? BookmarkCheck : Bookmark}
                    onClick={onSave}
                    active={isSaved}
                  />
                )}
                {onShare && (
                  <ActionBtn label="Share" Icon={Share2} onClick={onShare} />
                )}
                <ActionBtn
                  label="Markdown"
                  Icon={FileText}
                  onClick={() =>
                    downloadAs(
                      "md",
                      query,
                      `# ${query}\n\n${answer}\n\n---\n\n## Sources\n\n${sources.map((s) => `${s.id}. [${s.title}](${s.url})`).join("\n")}`,
                    )
                  }
                />
                {hasBibtex && (
                  <ActionBtn
                    label="BibTeX"
                    Icon={FileCode2}
                    onClick={() =>
                      downloadAs("bib", query, generateBibtex(sources, answer))
                    }
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function ModelTrigger({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span>{label}</span>
    </button>
  );
}

function ActionBtn({
  label,
  Icon,
  onClick,
  active,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors ${
        active
          ? "text-indigo-300"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
