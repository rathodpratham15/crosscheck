"use client";

import Link from "next/link";
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
import { isSaved, saveConversation, deleteSaved } from "@/lib/saved";
import type { Source } from "@/lib/tavily";

const MIN_QUERY_LENGTH = 5;
const MAX_HISTORY = 8;
const HISTORY_KEY = "crosscheck-history";

function getDomain(url: string): string {
  if (url.includes("arxiv.org")) return "arXiv";
  if (url.includes("semanticscholar.org")) return "S2";
  if (url.includes("paperswithcode.com")) return "PwC";
  if (url.includes("github.com")) return "GitHub";
  return "Other";
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

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

  // Gemini comparison
  const [geminiAnswer, setGeminiAnswer] = useState("");
  const [geminiSources, setGeminiSources] = useState<Source[]>([]);
  const [geminiVerifications, setGeminiVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [geminiIsStreaming, setGeminiIsStreaming] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Save state
  const [savedId, setSavedId] = useState<string | null>(null);

  async function fetchSuggestions(q: string, ans: string) {
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, answer: ans }),
      });
      if (res.ok) {
        const data = (await res.json()) as { suggestions: string[] };
        setSuggestions(data.suggestions ?? []);
      }
    } catch {}
  }

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
    setGeminiAnswer("");
    setGeminiSources([]);
    setGeminiVerifications({});
    setGeminiError(null);
    setSuggestions([]);
    setActiveFilters(new Set());
    setSavedId(null);

    // Update URL for shareability
    window.history.replaceState(
      {},
      "",
      `?q=${encodeURIComponent(trimmed)}`,
    );

    let accumulatedAnswer = "";
    try {
      await streamResearch(
        { query: trimmed, history: historyArg },
        {
          onSources: setSources,
          onDelta: (text) => {
            accumulatedAnswer += text;
            setAnswer((prev) => prev + text);
          },
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
      if (accumulatedAnswer) void fetchSuggestions(trimmed, accumulatedAnswer);
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

  async function runGeminiCompare() {
    if (geminiIsStreaming || !submittedQuery) return;
    setGeminiAnswer("");
    setGeminiSources([]);
    setGeminiVerifications({});
    setGeminiError(null);
    setGeminiIsStreaming(true);

    try {
      await streamResearch(
        { query: submittedQuery, provider: "gemini" },
        {
          onSources: setGeminiSources,
          onDelta: (text) => setGeminiAnswer((prev) => prev + text),
          onVerificationStart: (ids) =>
            setGeminiVerifications((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = { status: "checking" };
              return next;
            }),
          onVerification: (id, status, reason, quote) =>
            setGeminiVerifications((prev) => ({
              ...prev,
              [id]: { status, reason, quote },
            })),
          onError: setGeminiError,
        },
      );
    } catch (err) {
      setGeminiError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeminiIsStreaming(false);
    }
  }

  function handleSave() {
    if (!answer || !submittedQuery) return;
    if (savedId) {
      deleteSaved(savedId);
      setSavedId(null);
    } else {
      const entry = saveConversation({
        query: submittedQuery,
        answer,
        sources,
        verifications,
      });
      setSavedId(entry.id);
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

  function toggleFilter(domain: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  const hasResult = answer.length > 0 || sources.length > 0;
  const hasCitations =
    answer.length > 0 && /\[\d+\]/.test(answer) && sources.length > 0;
  const hasGptResult = gptAnswer.length > 0 || gptSources.length > 0;
  const hasGeminiResult = geminiAnswer.length > 0 || geminiSources.length > 0;
  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null;

  // Source domain filtering
  const sourceDomains = [...new Set(sources.map((s) => getDomain(s.url)))];
  const filteredSources =
    activeFilters.size === 0
      ? sources
      : sources.filter((s) => activeFilters.has(getDomain(s.url)));

  // Confidence score
  const verificationValues = Object.values(verifications);
  const totalChecked = verificationValues.filter(
    (v) => v.status !== "checking",
  ).length;
  const totalVerified = verificationValues.filter(
    (v) => v.status === "verified",
  ).length;
  const confidenceScore =
    !isStreaming && totalChecked > 0
      ? Math.round((totalVerified / totalChecked) * 100)
      : null;
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
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            crosscheck<span className="text-indigo-500">.</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Citations you can verify, not just trust.
          </p>
        </div>
        <Link
          href="/saved"
          className="mt-1 text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Saved ↗
        </Link>
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
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Claude
                </span>
                {confidenceScore !== null && (
                  <span
                    className={
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums " +
                      (confidenceScore >= 80
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : confidenceScore >= 50
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300")
                    }
                  >
                    {confidenceScore}% verified
                  </span>
                )}
              </div>
              {streamingStep && streamingStep !== "searching" && (
                <ResearchProgress step={streamingStep} />
              )}
            </div>
            {sourceDomains.length > 1 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {sourceDomains.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleFilter(domain)}
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors " +
                      (activeFilters.has(domain)
                        ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700")
                    }
                  >
                    {domain}
                  </button>
                ))}
                {activeFilters.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilters(new Set())}
                    className="text-[11px] text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            <SourceStrip
              sources={filteredSources}
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-3">
                  {hasCitations && (
                    <>
                      <button
                        type="button"
                        onClick={() => void runGptCompare()}
                        disabled={gptIsStreaming}
                        className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-40 dark:hover:text-zinc-200"
                      >
                        {hasGptResult || gptIsStreaming
                          ? "↺ GPT-4o mini"
                          : "GPT-4o mini →"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runGeminiCompare()}
                        disabled={geminiIsStreaming}
                        className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-40 dark:hover:text-zinc-200"
                      >
                        {hasGeminiResult || geminiIsStreaming
                          ? "↺ Gemini"
                          : "Gemini →"}
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    className={
                      "text-xs transition-colors " +
                      (savedId
                        ? "text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
                        : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200")
                    }
                  >
                    {savedId ? "Saved ★" : "Save ☆"}
                  </button>
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

      {/* Gemini comparison result */}
      {(hasGeminiResult || geminiIsStreaming) && (
        <section className="animate-fade-in min-w-0 rounded-lg border border-teal-200 bg-white px-4 py-4 dark:border-teal-900 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-500">
              Gemini 2.0 Flash
            </span>
            {geminiIsStreaming && (
              <ResearchProgress
                step={
                  geminiSources.length === 0
                    ? "searching"
                    : Object.values(geminiVerifications).some(
                          (v) => v.status === "checking",
                        )
                      ? "verifying"
                      : "generating"
                }
              />
            )}
          </div>
          {geminiIsStreaming && geminiSources.length === 0 && (
            <SearchingIndicator />
          )}
          <SourceStrip
            sources={geminiSources}
            selectedId={null}
            onSelect={() => {}}
            getStatus={(id) => geminiVerifications[id]?.status}
          />
          <Answer
            text={geminiAnswer}
            onCitationClick={() => {}}
            getCitationStatus={(id) => geminiVerifications[id]?.status}
          />
          {geminiError && (
            <p className="mt-2 text-xs text-red-500">{geminiError}</p>
          )}
        </section>
      )}

      {suggestions.length > 0 && !isStreaming && (
        <div className="animate-fade-in">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Explore further
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const history = [
                    ...turns.map((t) => ({ query: t.query, answer: t.answer })),
                    ...(answer ? [{ query: submittedQuery, answer }] : []),
                  ];
                  if (answer) {
                    setTurns((prev) => [
                      ...prev,
                      { query: submittedQuery, answer, sources, verifications },
                    ]);
                  }
                  void runSearch(s, history);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
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
