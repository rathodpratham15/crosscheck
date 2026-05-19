"use client";

import { useEffect, useRef, useState } from "react";
import { Answer } from "@/components/answer";
import type { CitationStatus } from "@/components/citation-chip";
import { ExamplePrompts } from "@/components/example-prompts";
import {
  ResearchProgress,
  type ResearchStep,
} from "@/components/research-progress";
import { SearchingIndicator } from "@/components/searching-indicator";
import {
  SourceSidePanel,
  type VerificationDisplay,
} from "@/components/source-side-panel";
import { SourceStrip } from "@/components/source-strip";
import type { Source } from "@/lib/tavily";

const MIN_QUERY_LENGTH = 5;
const MAX_HISTORY = 8;
const HISTORY_KEY = "crosscheck-history";

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

function generateMarkdown(
  query: string,
  answer: string,
  sources: Source[],
): string {
  const srcBlock = sources
    .map((s) => `${s.id}. [${s.title}](${s.url})`)
    .join("\n");
  return `# ${query}\n\n${answer}\n\n---\n\n## Sources\n\n${srcBlock}`;
}

type ServerEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "verification-start"; citationIds: number[] }
  | {
      type: "verification";
      citationId: number;
      status: "verified" | "unsupported";
      reason: string;
      quote: string;
    }
  | { type: "error"; message: string };

type Turn = {
  query: string;
  answer: string;
  sources: Source[];
  verifications: Record<number, VerificationDisplay>;
};

async function streamResearch(
  body: Record<string, unknown>,
  callbacks: {
    onSources: (sources: Source[]) => void;
    onDelta: (text: string) => void;
    onVerificationStart: (ids: number[]) => void;
    onVerification: (
      id: number,
      status: "verified" | "unsupported",
      reason: string,
      quote: string,
    ) => void;
    onError: (msg: string) => void;
  },
): Promise<void> {
  const res = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (!line.trim()) continue;
      let event: ServerEvent;
      try {
        event = JSON.parse(line) as ServerEvent;
      } catch {
        continue;
      }
      if (event.type === "sources") callbacks.onSources(event.sources);
      else if (event.type === "delta") callbacks.onDelta(event.text);
      else if (event.type === "verification-start")
        callbacks.onVerificationStart(event.citationIds);
      else if (event.type === "verification")
        callbacks.onVerification(
          event.citationId,
          event.status,
          event.reason,
          event.quote,
        );
      else if (event.type === "error") callbacks.onError(event.message);
    }
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [verifications, setVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Search history
  const [history, setHistory] = useState<string[]>([]);
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        historyRef.current = parsed;
        setHistory(parsed);
      }
    } catch {}
    // Auto-run search if ?q= is in the URL
    const q = new URLSearchParams(window.location.search).get("q");
    if (q && q.trim().length >= MIN_QUERY_LENGTH) {
      setQuery(q);
      void runSearch(q, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveToHistory(q: string) {
    const next = [q, ...historyRef.current.filter((h) => h !== q)].slice(
      0,
      MAX_HISTORY,
    );
    historyRef.current = next;
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }

  function clearHistory() {
    historyRef.current = [];
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  }

  // GPT comparison
  const [gptAnswer, setGptAnswer] = useState("");
  const [gptSources, setGptSources] = useState<Source[]>([]);
  const [gptVerifications, setGptVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [gptIsStreaming, setGptIsStreaming] = useState(false);
  const [gptError, setGptError] = useState<string | null>(null);

  async function runSearch(
    q: string,
    historyArg: { query: string; answer: string }[],
  ) {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH || isStreaming) return;

    setSubmittedQuery(trimmed);
    setAnswer("");
    setSources([]);
    setSelectedSourceId(null);
    setVerifications({});
    setError(null);
    setIsStreaming(true);
    setFollowUpQuery("");
    setGptAnswer("");
    setGptSources([]);
    setGptVerifications({});
    setGptError(null);

    // Update URL for shareability
    window.history.replaceState(
      {},
      "",
      `?q=${encodeURIComponent(trimmed)}`,
    );

    try {
      await streamResearch(
        { query: trimmed, history: historyArg },
        {
          onSources: setSources,
          onDelta: (text) => setAnswer((prev) => prev + text),
          onVerificationStart: (ids) =>
            setVerifications((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = { status: "checking" };
              return next;
            }),
          onVerification: (id, status, reason, quote) =>
            setVerifications((prev) => ({
              ...prev,
              [id]: { status, reason, quote },
            })),
          onError: setError,
        },
      );
      saveToHistory(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }

  async function runGptCompare() {
    if (gptIsStreaming || !submittedQuery) return;
    setGptAnswer("");
    setGptSources([]);
    setGptVerifications({});
    setGptError(null);
    setGptIsStreaming(true);

    try {
      await streamResearch(
        { query: submittedQuery, provider: "gpt" },
        {
          onSources: setGptSources,
          onDelta: (text) => setGptAnswer((prev) => prev + text),
          onVerificationStart: (ids) =>
            setGptVerifications((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = { status: "checking" };
              return next;
            }),
          onVerification: (id, status, reason, quote) =>
            setGptVerifications((prev) => ({
              ...prev,
              [id]: { status, reason, quote },
            })),
          onError: setGptError,
        },
      );
    } catch (err) {
      setGptError(err instanceof Error ? err.message : String(err));
    } finally {
      setGptIsStreaming(false);
    }
  }

  function handleCopyBibtex() {
    const bib = generateBibtex(sources, answer);
    if (!bib) return;
    void navigator.clipboard.writeText(bib).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyMarkdown() {
    const md = generateMarkdown(submittedQuery, answer, sources);
    void navigator.clipboard.writeText(md).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    });
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  function handleNewSearch() {
    if (query.trim().length < MIN_QUERY_LENGTH || isStreaming) return;
    setTurns([]);
    void runSearch(query, []);
  }

  function handleFollowUp() {
    if (followUpQuery.trim().length < MIN_QUERY_LENGTH || isStreaming) return;

    const priorHistory = [
      ...turns.map((t) => ({ query: t.query, answer: t.answer })),
      ...(answer ? [{ query: submittedQuery, answer }] : []),
    ];

    if (answer) {
      setTurns((prev) => [
        ...prev,
        { query: submittedQuery, answer, sources, verifications },
      ]);
    }

    void runSearch(followUpQuery, priorHistory);
  }

  const hasResult = answer.length > 0 || sources.length > 0;
  const hasCitations =
    answer.length > 0 && /\[\d+\]/.test(answer) && sources.length > 0;
  const hasGptResult = gptAnswer.length > 0 || gptSources.length > 0;
  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null;
  const getStatus = (id: number): CitationStatus | undefined =>
    verifications[id]?.status;
  const selectedVerification = selectedSource
    ? verifications[selectedSource.id]
    : undefined;
  const isEmpty = !hasResult && !isStreaming && turns.length === 0;
  const trimmedLen = query.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < MIN_QUERY_LENGTH;

  // Derive streaming step for progress indicator
  const streamingStep: ResearchStep | null = !isStreaming
    ? null
    : sources.length === 0
      ? "searching"
      : Object.values(verifications).some((v) => v.status === "checking")
        ? "verifying"
        : "generating";

  return (
    <main
      className={
        "mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16 " +
        (isEmpty ? "justify-center" : "")
      }
    >
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">
          crosscheck<span className="text-indigo-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Citations you can verify, not just trust.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleNewSearch();
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleNewSearch();
            }
          }}
          placeholder="Ask anything about AI/ML research…"
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition-colors focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-indigo-400"
          disabled={isStreaming}
        />
        <div className="flex items-center justify-between">
          {tooShort ? (
            <p className="text-xs text-zinc-500">
              Type at least {MIN_QUERY_LENGTH} characters
            </p>
          ) : (
            <p className="text-xs text-zinc-500">⌘↵ to ask</p>
          )}
          <button
            type="submit"
            disabled={isStreaming || trimmedLen < MIN_QUERY_LENGTH}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:disabled:hover:bg-indigo-500"
          >
            {isStreaming ? "Streaming…" : "Ask"}
          </button>
        </div>
      </form>

      {isEmpty && !error && (
        <>
          <ExamplePrompts onSelect={setQuery} />
          {history.length > 0 && (
            <div className="animate-fade-in">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Recent
                </p>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setQuery(h)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Top-level searching indicator (before any result, first search) */}
      {isStreaming && sources.length === 0 && turns.length === 0 && (
        <div className="animate-fade-in">
          <SearchingIndicator />
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="animate-fade-in flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] leading-none font-bold text-white"
          >
            !
          </span>
          <div className="flex-1">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-0.5 leading-5 opacity-90">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="-mt-1 -mr-2 rounded p-1 text-red-700 transition-colors hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900"
          >
            ✕
          </button>
        </div>
      )}

      {turns.map((turn, i) => (
        <section
          key={i}
          className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            {turn.query}
          </p>
          <Answer
            text={turn.answer}
            onCitationClick={() => {}}
            getCitationStatus={(id) => turn.verifications[id]?.status}
          />
        </section>
      ))}

      {(hasResult || (isStreaming && turns.length > 0)) && (
        <>
          {isStreaming && sources.length === 0 && (
            <div className="animate-fade-in">
              <SearchingIndicator />
            </div>
          )}
          <section className="animate-fade-in min-w-0 rounded-lg border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Claude
              </span>
              {streamingStep && streamingStep !== "searching" && (
                <ResearchProgress step={streamingStep} />
              )}
            </div>
            <SourceStrip
              sources={sources}
              selectedId={selectedSourceId}
              onSelect={setSelectedSourceId}
              getStatus={getStatus}
            />
            <Answer
              text={answer}
              onCitationClick={setSelectedSourceId}
              getCitationStatus={getStatus}
            />
            {hasResult && !isStreaming && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  {hasCitations && (
                    <button
                      type="button"
                      onClick={() => void runGptCompare()}
                      disabled={gptIsStreaming}
                      className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-40 dark:hover:text-zinc-200"
                    >
                      {hasGptResult || gptIsStreaming
                        ? "↺ Re-compare GPT-4o mini"
                        : "Compare with GPT-4o mini →"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {copiedLink ? "Copied!" : "Share ↗"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {copiedMd ? "Copied!" : "Markdown"}
                  </button>
                  {hasCitations && (
                    <button
                      type="button"
                      onClick={handleCopyBibtex}
                      className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {copied ? "Copied!" : "BibTeX"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* GPT-4o comparison result */}
      {(hasGptResult || gptIsStreaming) && (
        <section className="animate-fade-in min-w-0 rounded-lg border border-violet-200 bg-white px-4 py-4 dark:border-violet-900 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">
              GPT-4o mini
            </span>
            {gptIsStreaming && (
              <ResearchProgress
                step={
                  gptSources.length === 0
                    ? "searching"
                    : Object.values(gptVerifications).some(
                          (v) => v.status === "checking",
                        )
                      ? "verifying"
                      : "generating"
                }
              />
            )}
          </div>
          {gptIsStreaming && gptSources.length === 0 && <SearchingIndicator />}
          <SourceStrip
            sources={gptSources}
            selectedId={null}
            onSelect={() => {}}
            getStatus={(id) => gptVerifications[id]?.status}
          />
          <Answer
            text={gptAnswer}
            onCitationClick={() => {}}
            getCitationStatus={(id) => gptVerifications[id]?.status}
          />
          {gptError && (
            <p className="mt-2 text-xs text-red-500">{gptError}</p>
          )}
        </section>
      )}

      {hasResult && !isStreaming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFollowUp();
          }}
          className="flex gap-2"
        >
          <textarea
            value={followUpQuery}
            onChange={(e) => setFollowUpQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleFollowUp();
              }
            }}
            placeholder="Ask a follow-up…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition-colors focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={followUpQuery.trim().length < MIN_QUERY_LENGTH}
            className="self-end rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Follow up ↩
          </button>
        </form>
      )}

      <SourceSidePanel
        source={selectedSource}
        verification={selectedVerification}
        onClose={() => setSelectedSourceId(null)}
      />
    </main>
  );
}
