"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { SearchComposer } from "@/components/search-composer";
import { EmptyState } from "@/components/empty-state";
import { StreamingState, type StreamStep } from "@/components/streaming-state";
import { ResultCard } from "@/components/result-card";
import { ExploreFurther } from "@/components/explore-further";
import { FollowUpComposer } from "@/components/follow-up";
import { SourceDetail } from "@/components/source-detail";
import type { VerificationDisplay } from "@/components/source-side-panel";
import { saveConversation, deleteSaved } from "@/lib/saved";
import type { Source } from "@/lib/tavily";

const MIN_QUERY_LENGTH = 5;
const MAX_HISTORY = 8;
const HISTORY_KEY = "crosscheck-history";
const CACHE_TTL = 24 * 60 * 60 * 1000;

const EXAMPLE_PROMPTS = [
  "What is Luma AI?",
  "Chinchilla scaling law explained",
  "Compare diffusion transformers vs autoregressive models",
  "State-space models vs transformers — current state of the art",
  "RLHF vs DPO: what changed in 2024?",
  "Best benchmarks for code generation models",
];

type SessionCache = {
  query: string;
  answer: string;
  sources: Source[];
  verifications: Record<number, VerificationDisplay>;
  turns: Turn[];
  cachedAt: number;
};

function loadCache(q: string): SessionCache | null {
  try {
    const raw = localStorage.getItem(`crosscheck-cache-${q}`);
    if (!raw) return null;
    const c = JSON.parse(raw) as SessionCache;
    if (Date.now() - c.cachedAt > CACHE_TTL) return null;
    return c;
  } catch {
    return null;
  }
}

function saveCache(q: string, data: Omit<SessionCache, "cachedAt">) {
  try {
    localStorage.setItem(
      `crosscheck-cache-${q}`,
      JSON.stringify({ ...data, cachedAt: Date.now() }),
    );
  } catch {}
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
  gptAnswer?: string;
  gptSources?: Source[];
  gptVerifications?: Record<number, VerificationDisplay>;
  geminiAnswer?: string;
  geminiSources?: Source[];
  geminiVerifications?: Record<number, VerificationDisplay>;
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
  const { data: session } = useSession();

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [selectedSourceModel, setSelectedSourceModel] = useState<"claude" | "gpt" | "gemini">("claude");
  const [verifications, setVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cachedResult, setCachedResult] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [history, setHistory] = useState<string[]>([]);
  const historyRef = useRef<string[]>([]);

  // Each past conversation = one new-search session (follow-ups within it are all its turns)
  type ConversationSummary = { title: string; turns: Turn[] };
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [viewingConvIndex, setViewingConvIndex] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        historyRef.current = parsed;
        setHistory(parsed);
      }
    } catch {}

    const q = new URLSearchParams(window.location.search).get("q");
    if (q && q.trim().length >= MIN_QUERY_LENGTH) {
      setQuery(q);
      const cached = loadCache(q);
      if (cached) {
        setSubmittedQuery(q);
        setAnswer(cached.answer);
        setSources(cached.sources);
        setVerifications(cached.verifications);
        setTurns(cached.turns);
        setCachedResult(true);
      } else {
        void runSearch(q, []);
      }
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
    priorTurns: Turn[] = [],
  ) {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH || isStreaming) return;

    setSubmittedQuery(trimmed);
    setViewingConvIndex(null);
    setAnswer("");
    setSources([]);
    setSelectedSourceId(null);
    setSelectedSourceModel("claude");
    setVerifications({});
    setError(null);
    setIsStreaming(true);
    setGptAnswer("");
    setGptSources([]);
    setGptVerifications({});
    setGptError(null);
    setGeminiAnswer("");
    setGeminiSources([]);
    setGeminiVerifications({});
    setGeminiError(null);
    setSuggestions([]);
    setSavedId(null);
    setCachedResult(false);

    window.history.replaceState({}, "", `?q=${encodeURIComponent(trimmed)}`);

    let accumulatedAnswer = "";
    let localSources: Source[] = [];
    let localVerifications: Record<number, VerificationDisplay> = {};

    try {
      await streamResearch(
        { query: trimmed, history: historyArg },
        {
          onSources: (s) => {
            localSources = s;
            setSources(s);
          },
          onDelta: (text) => {
            accumulatedAnswer += text;
            setAnswer((prev) => prev + text);
          },
          onVerificationStart: (ids) =>
            setVerifications((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = { status: "checking" };
              localVerifications = next;
              return next;
            }),
          onVerification: (id, status, reason, quote) =>
            setVerifications((prev) => {
              const next = { ...prev, [id]: { status, reason, quote } };
              localVerifications = next;
              return next;
            }),
          onError: setError,
        },
      );
      saveToHistory(trimmed);
      if (accumulatedAnswer) {
        void fetchSuggestions(trimmed, accumulatedAnswer);
        saveCache(trimmed, {
          query: trimmed,
          answer: accumulatedAnswer,
          sources: localSources,
          verifications: localVerifications,
          turns: priorTurns,
        });
      }
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

  async function saveTurnData(
    q: string,
    ans: string,
    srcs: Source[],
    verifs: Record<number, VerificationDisplay>,
  ): Promise<string | null> {
    if (session?.user) {
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, answer: ans, sources: srcs, verifications: verifs }),
        });
        if (res.ok) {
          const entry = (await res.json()) as { id: string };
          return entry.id;
        }
      } catch {}
    } else {
      const entry = saveConversation({ query: q, answer: ans, sources: srcs, verifications: verifs });
      return entry.id;
    }
    return null;
  }

  async function shareTurnData(
    q: string,
    ans: string,
    srcs: Source[],
    verifs: Record<number, VerificationDisplay>,
  ) {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, answer: ans, sources: srcs, verifications: verifs }),
      });
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
        return;
      }
    } catch {}
    await navigator.clipboard.writeText(window.location.href);
  }

  async function handleSave() {
    if (!answer || !submittedQuery) return;
    if (savedId) {
      if (session?.user) {
        await fetch(`/api/saved/${savedId}`, { method: "DELETE" });
      } else {
        deleteSaved(savedId);
      }
      setSavedId(null);
    } else {
      const id = await saveTurnData(submittedQuery, answer, sources, verifications);
      if (id) setSavedId(id);
    }
  }

  async function handleShare() {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: submittedQuery,
          answer,
          sources,
          verifications,
        }),
      });
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        await navigator.clipboard.writeText(
          `${window.location.origin}/share/${id}`,
        );
        return;
      }
    } catch {}
    await navigator.clipboard.writeText(window.location.href);
  }

  function buildCurrentTurn(): Turn {
    return {
      query: submittedQuery,
      answer,
      sources,
      verifications,
      ...(gptAnswer || gptSources.length > 0
        ? { gptAnswer, gptSources, gptVerifications }
        : {}),
      ...(geminiAnswer || geminiSources.length > 0
        ? { geminiAnswer, geminiSources, geminiVerifications }
        : {}),
    };
  }

  function handleNewSearch(q: string) {
    if (q.trim().length < MIN_QUERY_LENGTH || isStreaming) return;
    // Archive the current conversation before starting fresh
    if (submittedQuery && (answer || turns.length > 0)) {
      const title = turns.length > 0 ? turns[0].query : submittedQuery;
      const allTurns = answer ? [...turns, buildCurrentTurn()] : turns;
      setPastConversations((prev) => [{ title, turns: allTurns }, ...prev]);
    }
    setViewingConvIndex(null);
    setQuery("");
    setTurns([]);
    void runSearch(q, []);
  }

  function handleFollowUp(q: string) {
    if (q.trim().length < 1 || isStreaming) return;
    const priorHistory = [
      ...turns.map((t) => ({ query: t.query, answer: t.answer })),
      ...(answer ? [{ query: submittedQuery, answer }] : []),
    ];
    const newTurns = answer ? [...turns, buildCurrentTurn()] : turns;
    if (answer) setTurns(newTurns);
    setQuery("");
    void runSearch(q, priorHistory, newTurns);
  }

  function handleExplorePick(q: string) {
    const history = [
      ...turns.map((t) => ({ query: t.query, answer: t.answer })),
      ...(answer ? [{ query: submittedQuery, answer }] : []),
    ];
    const newTurns = answer ? [...turns, buildCurrentTurn()] : turns;
    if (answer) setTurns(newTurns);
    setQuery("");
    void runSearch(q, history, newTurns);
  }

  // Derived state
  const hasResult = answer.length > 0 || sources.length > 0;
  const hasCitations =
    answer.length > 0 && /\[\d+\]/.test(answer) && sources.length > 0;
  const hasGptResult = gptAnswer.length > 0 || gptSources.length > 0;
  const hasGeminiResult = geminiAnswer.length > 0 || geminiSources.length > 0;
  const isEmpty =
    !hasResult && !isStreaming && turns.length === 0 && !error;

  const sourcesByModel = { claude: sources, gpt: gptSources, gemini: geminiSources };
  const verifsByModel = { claude: verifications, gpt: gptVerifications, gemini: geminiVerifications };
  const selectedSource =
    selectedSourceId !== null
      ? (sourcesByModel[selectedSourceModel].find((s) => s.id === selectedSourceId) ?? null)
      : null;
  const selectedVerification = selectedSource
    ? verifsByModel[selectedSourceModel][selectedSource.id]
    : undefined;

  function selectSource(id: number, model: "claude" | "gpt" | "gemini" = "claude") {
    setSelectedSourceId(id);
    setSelectedSourceModel(model);
  }

  const streamingStep: StreamStep = isStreaming
    ? sources.length === 0
      ? "searching"
      : Object.values(verifications).some((v) => v.status === "checking")
        ? "verifying"
        : "generating"
    : "searching";

  const gptStep: StreamStep = gptIsStreaming
    ? gptSources.length === 0
      ? "searching"
      : Object.values(gptVerifications).some((v) => v.status === "checking")
        ? "verifying"
        : "generating"
    : "searching";

  const geminiStep: StreamStep = geminiIsStreaming
    ? geminiSources.length === 0
      ? "searching"
      : Object.values(geminiVerifications).some((v) => v.status === "checking")
        ? "verifying"
        : "generating"
    : "searching";

  const inComparisonMode = hasGptResult || gptIsStreaming || hasGeminiResult || geminiIsStreaming;
  const activeModelCount =
    1 +
    (hasGptResult || gptIsStreaming ? 1 : 0) +
    (hasGeminiResult || geminiIsStreaming ? 1 : 0);

  return (
    <>
      {isEmpty ? (
        /* ── Empty / hero state ── */
        <main className="flex-1 bg-grid">
          <div className="flex min-h-[calc(100svh-56px)] flex-col items-center justify-center px-5 py-12">
            <div className="mb-8 text-center">
              <h1 className="font-heading text-[28px] font-bold tracking-tight text-[var(--color-fg)] md:text-[36px]">
                Ask anything about AI/ML research
              </h1>
              <p className="mt-2 font-mono text-[12px] text-[var(--color-text-muted)]">
                Every citation verified against its source
              </p>
            </div>
            <div className="w-full max-w-xl">
              <SearchComposer
                value={query}
                onChange={setQuery}
                onSubmit={handleNewSearch}
                busy={isStreaming}
              />
            </div>
            <div className="mt-8 w-full max-w-xl">
              <EmptyState
                examples={EXAMPLE_PROMPTS}
                recent={history}
                onPick={handleNewSearch}
              />
            </div>
          </div>
        </main>
      ) : (
        /* ── Split layout ── */
        <main className="flex h-[calc(100svh-56px)] overflow-hidden bg-grid">

          {/* LEFT PANE — desktop only */}
          <aside
            className={`hidden md:flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-[width] duration-200 ease-in-out overflow-hidden ${
              sidebarCollapsed ? "w-12" : "w-[360px]"
            }`}
          >
            {sidebarCollapsed ? (
              /* Collapsed strip */
              <div className="flex flex-1 flex-col items-center pt-3">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <>
                {/* Search bar + collapse button */}
                <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-4">
                  <div className="min-w-0 flex-1">
                    <SearchComposer
                      compact
                      value={query}
                      onChange={setQuery}
                      onSubmit={handleNewSearch}
                      busy={isStreaming}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
                    aria-label="Collapse sidebar"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto scroll-thin py-2">
                  {pastConversations.length > 0 && (
                    <p className="mb-1 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      History
                    </p>
                  )}

                  {pastConversations.map((conv, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setViewingConvIndex(viewingConvIndex === i ? null : i)}
                      className={`mx-2 mb-1 w-[calc(100%-1rem)] rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-ink-2)] ${
                        viewingConvIndex === i ? "bg-[var(--color-ink-2)]" : "opacity-70"
                      }`}
                    >
                      <p className="truncate text-[13px] font-medium text-[var(--color-fg)]">
                        {conv.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {conv.turns.length} {conv.turns.length === 1 ? "turn" : "turns"}
                      </p>
                    </button>
                  ))}

                  {submittedQuery && (
                    <button
                      type="button"
                      onClick={() => setViewingConvIndex(null)}
                      className={`mx-2 w-[calc(100%-1rem)] rounded-lg px-3 py-2 text-left ring-1 ring-indigo-500/20 transition-colors ${
                        viewingConvIndex === null ? "bg-indigo-500/10" : "bg-indigo-500/5 opacity-70 hover:bg-indigo-500/10"
                      }`}
                    >
                      <p className="truncate text-[13px] font-medium text-[var(--color-fg)]">
                        {turns.length > 0 ? turns[0].query : submittedQuery}
                      </p>
                      <p className="mt-0.5 text-[11px] text-indigo-400">
                        {isStreaming ? "Researching…" : `${turns.length + 1} ${turns.length === 0 ? "turn" : "turns"}`}
                      </p>
                    </button>
                  )}
                </div>

                {/* Follow-up composer */}
                {hasResult && !isStreaming && viewingConvIndex === null && (
                  <div className="border-t border-[var(--color-border)] p-4">
                    <FollowUpComposer onSubmit={handleFollowUp} />
                  </div>
                )}
              </>
            )}
          </aside>

          {/* RIGHT PANE — results */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Mobile-only search bar */}
            <div className="border-b border-[var(--color-border)] p-3 md:hidden">
              <SearchComposer
                compact
                value={query}
                onChange={setQuery}
                onSubmit={handleNewSearch}
                busy={isStreaming}
              />
            </div>

            <div className="flex-1 overflow-y-auto scroll-thin">
              <div className={`mx-auto px-4 py-4 md:px-6 md:py-6 ${inComparisonMode ? "max-w-full" : "max-w-[780px]"}`}>

                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    className="mb-6 fade-up flex items-start gap-3 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-300"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                      !
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold">Something went wrong</p>
                      <p className="mt-0.5 opacity-80">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="text-red-400 hover:text-red-200"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Viewing a past conversation */}
                {viewingConvIndex !== null && pastConversations[viewingConvIndex] && (
                  <>
                    {pastConversations[viewingConvIndex]!.turns.map((turn, i) => {
                      const isLast = i === pastConversations[viewingConvIndex]!.turns.length - 1;
                      return (
                        <TurnBlock
                          key={i}
                          turn={turn}
                          collapsed={!isLast}
                          dimmed={!isLast}
                          onSelectSource={(id) => selectSource(id, "claude")}
                          onSave={saveTurnData}
                          onShare={shareTurnData}
                        />
                      );
                    })}
                  </>
                )}

                {/* Prior turns within the current conversation */}
                {viewingConvIndex === null && turns.map((turn, i) => (
                  <TurnBlock
                    key={i}
                    turn={turn}
                    collapsed
                    dimmed
                    onSelectSource={setSelectedSourceId}
                    onSave={saveTurnData}
                    onShare={shareTurnData}
                  />
                ))}

                {/* Current conversation — active result */}
                {viewingConvIndex === null && (
                  <>
                    {inComparisonMode ? (
                      /* ── Side-by-side comparison grid ── */
                      <>
                        {/* Shared question header */}
                        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-5 py-4">
                          <p className="font-heading text-[15px] font-semibold leading-snug text-[var(--color-fg)]">
                            {submittedQuery}
                          </p>
                        </div>

                        <div
                          className={`grid gap-4 items-start ${
                            activeModelCount === 3
                              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                              : "grid-cols-1 md:grid-cols-2"
                          }`}
                        >
                          {/* Claude */}
                          <div className="flex flex-col">
                            {isStreaming && sources.length === 0 && (
                              <div className="mb-4 fade-up">
                                <StreamingState query={submittedQuery} step={streamingStep} />
                              </div>
                            )}
                            {(hasResult || (isStreaming && sources.length > 0)) && (
                              <ResultCard
                                model="claude"
                                answer={answer}
                                sources={sources}
                                verifications={verifications}
                                isPrimary
                                isStreaming={isStreaming}
                                isSaved={!!savedId}
                                onSave={() => void handleSave()}
                                onShare={() => void handleShare()}
                                onSelectSource={(id) => selectSource(id, "claude")}
                                onRunGpt={
                                  hasCitations && !gptIsStreaming
                                    ? () => void runGptCompare()
                                    : undefined
                                }
                                onRunGemini={
                                  hasCitations && !geminiIsStreaming
                                    ? () => void runGeminiCompare()
                                    : undefined
                                }
                                gptDone={hasGptResult || gptIsStreaming}
                                geminiDone={hasGeminiResult || geminiIsStreaming}
                                cachedResult={cachedResult}
                                onRerun={() => {
                                  setCachedResult(false);
                                  void runSearch(submittedQuery, []);
                                }}
                                query={submittedQuery}
                              />
                            )}
                          </div>

                          {/* GPT */}
                          {(hasGptResult || gptIsStreaming) && (
                            <div className="flex flex-col">
                              {gptIsStreaming && gptSources.length === 0 && (
                                <div className="mb-4 fade-up">
                                  <StreamingState query={submittedQuery} step={gptStep} />
                                </div>
                              )}
                              {gptError && <p className="mb-2 text-xs text-red-400">{gptError}</p>}
                              {(gptAnswer || gptSources.length > 0) && (
                                <ResultCard
                                  model="gpt"
                                  answer={gptAnswer}
                                  sources={gptSources}
                                  verifications={gptVerifications}
                                  isStreaming={gptIsStreaming}
                                  onSelectSource={(id) => selectSource(id, "gpt")}
                                  query={submittedQuery}
                                />
                              )}
                            </div>
                          )}

                          {/* Llama */}
                          {(hasGeminiResult || geminiIsStreaming) && (
                            <div className="flex flex-col">
                              {geminiIsStreaming && geminiSources.length === 0 && (
                                <div className="mb-4 fade-up">
                                  <StreamingState query={submittedQuery} step={geminiStep} />
                                </div>
                              )}
                              {geminiError && <p className="mb-2 text-xs text-red-400">{geminiError}</p>}
                              {(geminiAnswer || geminiSources.length > 0) && (
                                <ResultCard
                                  model="gemini"
                                  answer={geminiAnswer}
                                  sources={geminiSources}
                                  verifications={geminiVerifications}
                                  isStreaming={geminiIsStreaming}
                                  onSelectSource={(id) => selectSource(id, "gemini")}
                                  query={submittedQuery}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {suggestions.length > 0 && !isStreaming && (
                          <div className="mt-6 mb-6 fade-up">
                            <ExploreFurther items={suggestions} onPick={handleExplorePick} />
                          </div>
                        )}
                      </>
                    ) : (
                      /* ── Normal single-model layout ── */
                      <>
                        {/* Claude — streaming state */}
                        {isStreaming && sources.length === 0 && (
                          <div className="mb-4 fade-up">
                            <StreamingState query={submittedQuery} step={streamingStep} />
                          </div>
                        )}

                        {/* Claude result */}
                        {(hasResult || (isStreaming && sources.length > 0)) && (
                          <div className="mb-6">
                            <ResultCard
                              model="claude"
                              answer={answer}
                              sources={sources}
                              verifications={verifications}
                              showQuery
                              isPrimary
                              isStreaming={isStreaming}
                              isSaved={!!savedId}
                              onSave={() => void handleSave()}
                              onShare={() => void handleShare()}
                              onSelectSource={(id) => selectSource(id, "claude")}
                              onRunGpt={
                                hasCitations && !gptIsStreaming
                                  ? () => void runGptCompare()
                                  : undefined
                              }
                              onRunGemini={
                                hasCitations && !geminiIsStreaming
                                  ? () => void runGeminiCompare()
                                  : undefined
                              }
                              gptDone={hasGptResult || gptIsStreaming}
                              geminiDone={hasGeminiResult || geminiIsStreaming}
                              cachedResult={cachedResult}
                              onRerun={() => {
                                setCachedResult(false);
                                void runSearch(submittedQuery, []);
                              }}
                              query={submittedQuery}
                            />
                          </div>
                        )}

                        {/* Explore further */}
                        {suggestions.length > 0 && !isStreaming && (
                          <div className="mb-6 fade-up">
                            <ExploreFurther items={suggestions} onPick={handleExplorePick} />
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

              </div>
            </div>

            {/* Mobile-only follow-up at bottom */}
            {hasResult && !isStreaming && viewingConvIndex === null && (
              <div className="border-t border-[var(--color-border)] p-3 md:hidden">
                <FollowUpComposer onSubmit={handleFollowUp} />
              </div>
            )}
          </div>
        </main>
      )}

      {/* Source detail overlay */}
      <SourceDetail
        source={selectedSource}
        verification={selectedVerification}
        onClose={() => { setSelectedSourceId(null); setSelectedSourceModel("claude"); }}
      />
    </>
  );
}

// Unified Q+A block: question header + all model cards nested inside one container
function TurnBlock({
  turn,
  collapsed,
  dimmed,
  onSelectSource,
  onSave,
  onShare,
}: {
  turn: {
    query: string;
    answer: string;
    sources: Source[];
    verifications: Record<number, VerificationDisplay>;
    gptAnswer?: string;
    gptSources?: Source[];
    gptVerifications?: Record<number, VerificationDisplay>;
    geminiAnswer?: string;
    geminiSources?: Source[];
    geminiVerifications?: Record<number, VerificationDisplay>;
  };
  collapsed?: boolean;
  dimmed?: boolean;
  onSelectSource: (id: number) => void;
  onSave: (q: string, a: string, s: Source[], v: Record<number, VerificationDisplay>) => Promise<string | null>;
  onShare: (q: string, a: string, s: Source[], v: Record<number, VerificationDisplay>) => Promise<void>;
}) {
  return (
    <div
      className={`mb-6 overflow-hidden rounded-xl border border-[var(--color-border)] transition-opacity ${dimmed ? "opacity-70" : ""}`}
      style={{ borderLeftWidth: 2, borderLeftColor: "var(--color-claude)" }}
    >
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <p className="font-heading text-[15px] font-semibold leading-snug text-[var(--color-fg)]">
          {turn.query}
        </p>
      </div>
      <ResultCard
        nested
        model="claude"
        answer={turn.answer}
        sources={turn.sources}
        verifications={turn.verifications}
        initialCollapsed={collapsed}
        onSelectSource={onSelectSource}
        onSave={() => void onSave(turn.query, turn.answer, turn.sources, turn.verifications)}
        onShare={() => void onShare(turn.query, turn.answer, turn.sources, turn.verifications)}
        query={turn.query}
      />
      {turn.gptAnswer && (
        <div className="border-t border-[var(--color-border)]">
          <ResultCard
            nested
            model="gpt"
            answer={turn.gptAnswer}
            sources={turn.gptSources ?? []}
            verifications={turn.gptVerifications ?? {}}
            initialCollapsed={collapsed}
            onSelectSource={onSelectSource}
            query={turn.query}
          />
        </div>
      )}
      {turn.geminiAnswer && (
        <div className="border-t border-[var(--color-border)]">
          <ResultCard
            nested
            model="gemini"
            answer={turn.geminiAnswer}
            sources={turn.geminiSources ?? []}
            verifications={turn.geminiVerifications ?? {}}
            initialCollapsed={collapsed}
            onSelectSource={onSelectSource}
            query={turn.query}
          />
        </div>
      )}
    </div>
  );
}
