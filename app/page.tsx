"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { SearchComposer } from "@/components/search-composer";
import { EmptyState } from "@/components/empty-state";
import { StreamingState, type StreamStep } from "@/components/streaming-state";
import { ResultCard } from "@/components/result-card";
import { ExploreFurther } from "@/components/explore-further";
import { FollowUpComposer } from "@/components/follow-up";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { NewSourceStrip } from "@/components/source-pill";
import { SourceDetail } from "@/components/source-detail";
import { AddModelModal } from "@/components/add-model-modal";
import type { VerificationDisplay } from "@/components/source-side-panel";
import { saveConversation, deleteSaved } from "@/lib/saved";
import type { Source } from "@/lib/tavily";
import { type CustomModel, loadCustomModels } from "@/lib/custom-models";

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
  googleAnswer?: string;
  googleSources?: Source[];
  googleVerifications?: Record<number, VerificationDisplay>;
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
  const [detailSource, setDetailSource] = useState<Source | null>(null);
  const [detailVerif, setDetailVerif] = useState<VerificationDisplay | undefined>(undefined);
  const [verifications, setVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cachedResult, setCachedResult] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

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

  // Llama (Groq) comparison
  const [geminiAnswer, setGeminiAnswer] = useState("");
  const [geminiSources, setGeminiSources] = useState<Source[]>([]);
  const [geminiVerifications, setGeminiVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [geminiIsStreaming, setGeminiIsStreaming] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Google Gemini comparison
  const [googleAnswer, setGoogleAnswer] = useState("");
  const [googleSources, setGoogleSources] = useState<Source[]>([]);
  const [googleVerifications, setGoogleVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [googleIsStreaming, setGoogleIsStreaming] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Custom model comparison slots
  type CustomSlot = {
    model: CustomModel;
    answer: string;
    sources: Source[];
    verifications: Record<number, VerificationDisplay>;
    isStreaming: boolean;
    error: string | null;
  };
  const [customSlots, setCustomSlots] = useState<Record<string, CustomSlot>>({});
  const [savedCustomModels, setSavedCustomModels] = useState<CustomModel[]>([]);
  const [showAddModel, setShowAddModel] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        historyRef.current = parsed;
        setHistory(parsed);
      }
    } catch {}
    setSavedCustomModels(loadCustomModels());

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
    setDetailSource(null);
    setDetailVerif(undefined);
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
    setGoogleAnswer("");
    setGoogleSources([]);
    setGoogleVerifications({});
    setGoogleError(null);
    setCustomSlots({});
    setSuggestions([]);
    setSavedId(null);
    setCachedResult(false);

    window.history.replaceState({}, "", `?q=${encodeURIComponent(trimmed)}`);

    let accumulatedAnswer = "";
    let localSources: Source[] = [];
    let localVerifications: Record<number, VerificationDisplay> = {};

    try {
      await streamResearch(
        { query: trimmed, history: historyArg, provider: "gemini" },
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

  async function runGoogleCompare() {
    if (googleIsStreaming || !submittedQuery) return;
    setGoogleAnswer("");
    setGoogleSources([]);
    setGoogleVerifications({});
    setGoogleError(null);
    setGoogleIsStreaming(true);
    try {
      await streamResearch(
        { query: submittedQuery, provider: "google" },
        {
          onSources: setGoogleSources,
          onDelta: (text) => setGoogleAnswer((prev) => prev + text),
          onVerificationStart: (ids) =>
            setGoogleVerifications((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = { status: "checking" };
              return next;
            }),
          onVerification: (id, status, reason, quote) =>
            setGoogleVerifications((prev) => ({
              ...prev,
              [id]: { status, reason, quote },
            })),
          onError: setGoogleError,
        },
      );
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : String(err));
    } finally {
      setGoogleIsStreaming(false);
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

  async function runCustomModel(model: CustomModel, queryOverride?: string) {
    const q = queryOverride ?? submittedQuery;
    if (!q) return;
    const slot: CustomSlot = {
      model,
      answer: "",
      sources: [],
      verifications: {},
      isStreaming: true,
      error: null,
    };
    setCustomSlots((prev) => ({ ...prev, [model.id]: slot }));

    const update = (patch: Partial<CustomSlot>) =>
      setCustomSlots((prev) => ({
        ...prev,
        [model.id]: { ...prev[model.id]!, ...patch },
      }));

    try {
      await streamResearch(
        {
          query: q,
          provider: "custom",
          customProvider: model.provider,
          modelId: model.modelId,
          apiKey: model.apiKey,
          baseUrl: model.baseUrl,
        },
        {
          onSources: (s) => update({ sources: s }),
          onDelta: (text) =>
            setCustomSlots((prev) => {
              const cur = prev[model.id];
              if (!cur) return prev;
              return { ...prev, [model.id]: { ...cur, answer: cur.answer + text } };
            }),
          onVerificationStart: (ids) =>
            setCustomSlots((prev) => {
              const cur = prev[model.id];
              if (!cur) return prev;
              const verifs = { ...cur.verifications };
              for (const id of ids) verifs[id] = { status: "checking" };
              return { ...prev, [model.id]: { ...cur, verifications: verifs } };
            }),
          onVerification: (id, status, reason, quote) =>
            setCustomSlots((prev) => {
              const cur = prev[model.id];
              if (!cur) return prev;
              return {
                ...prev,
                [model.id]: {
                  ...cur,
                  verifications: { ...cur.verifications, [id]: { status, reason, quote } },
                },
              };
            }),
          onError: (msg) => update({ error: msg }),
        },
      );
    } catch (err) {
      update({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      update({ isStreaming: false });
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
      ...(googleAnswer || googleSources.length > 0
        ? { googleAnswer, googleSources, googleVerifications }
        : {}),
    };
  }

  function handleNewSearch(q: string) {
    if (q.trim().length < MIN_QUERY_LENGTH || isStreaming) return;
    setPendingQuery(q.trim());
  }

  function confirmSearch(q: string, compareModelIds: string[]) {
    setPendingQuery(null);
    // Archive current conversation
    if (submittedQuery && (answer || turns.length > 0)) {
      const title = turns.length > 0 ? turns[0].query : submittedQuery;
      const allTurns = answer ? [...turns, buildCurrentTurn()] : turns;
      setPastConversations((prev) => [{ title, turns: allTurns }, ...prev]);
    }
    setViewingConvIndex(null);
    setQuery("");
    setTurns([]);
    void runSearch(q, []);
    const modelsToCompare = savedCustomModels.filter((m) =>
      compareModelIds.includes(m.id),
    );
    for (const model of modelsToCompare) {
      void runCustomModel(model, q);
    }
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
  const hasGoogleResult = googleAnswer.length > 0 || googleSources.length > 0;
  const isEmpty =
    !hasResult && !isStreaming && turns.length === 0 && !error;

  function selectSource(id: number, model: "claude" | "gpt" | "gemini" | "google") {
    const srcList =
      model === "claude" ? sources :
      model === "gpt" ? gptSources :
      model === "google" ? googleSources :
      geminiSources;
    const verifMap =
      model === "claude" ? verifications :
      model === "gpt" ? gptVerifications :
      model === "google" ? googleVerifications :
      geminiVerifications;
    const src = srcList.find((s) => s.id === id) ?? null;
    setDetailSource(src);
    setDetailVerif(src ? verifMap[src.id] : undefined);
  }

  function selectCustomSource(id: number, slot: CustomSlot) {
    const src = slot.sources.find((s) => s.id === id) ?? null;
    setDetailSource(src);
    setDetailVerif(src ? slot.verifications[id] : undefined);
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

  const googleStep: StreamStep = googleIsStreaming
    ? googleSources.length === 0
      ? "searching"
      : Object.values(googleVerifications).some((v) => v.status === "checking")
        ? "verifying"
        : "generating"
    : "searching";

  const customSlotList = Object.values(customSlots);
  const hasAnyCustom = customSlotList.some((s) => s.answer.length > 0 || s.sources.length > 0 || s.isStreaming);
  const inComparisonMode = hasGptResult || gptIsStreaming || hasGeminiResult || geminiIsStreaming || hasGoogleResult || googleIsStreaming || hasAnyCustom;
  const activeModelCount =
    1 +
    (hasGptResult || gptIsStreaming ? 1 : 0) +
    (hasGeminiResult || geminiIsStreaming ? 1 : 0) +
    (hasGoogleResult || googleIsStreaming ? 1 : 0) +
    customSlotList.filter((s) => s.answer.length > 0 || s.sources.length > 0 || s.isStreaming).length;
  const activeCustomIds = customSlotList
    .filter((s) => s.answer.length > 0 || s.sources.length > 0 || s.isStreaming)
    .map((s) => s.model.id);

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
                onAddModel={() => setShowAddModel(true)}
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
                      onAddModel={() => setShowAddModel(true)}
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
                onAddModel={() => setShowAddModel(true)}
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
                    onSelectSource={(id) => selectSource(id, "claude")}
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
                            activeModelCount >= 3
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
                                model="gemini"
                                answer={answer}
                                sources={sources}
                                verifications={verifications}
                                isPrimary
                                isStreaming={isStreaming}
                                isSaved={!!savedId}
                                onSave={() => void handleSave()}
                                onShare={() => void handleShare()}
                                onSelectSource={(id) => selectSource(id, "gemini")}
                                onCompare={() => setShowAddModel(true)}
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

                          {/* Google Gemini */}
                          {(hasGoogleResult || googleIsStreaming) && (
                            <div className="flex flex-col">
                              {googleIsStreaming && googleSources.length === 0 && (
                                <div className="mb-4 fade-up">
                                  <StreamingState query={submittedQuery} step={googleStep} />
                                </div>
                              )}
                              {googleError && <p className="mb-2 text-xs text-red-400">{googleError}</p>}
                              {(googleAnswer || googleSources.length > 0) && (
                                <ResultCard
                                  model="google"
                                  answer={googleAnswer}
                                  sources={googleSources}
                                  verifications={googleVerifications}
                                  isStreaming={googleIsStreaming}
                                  onSelectSource={(id) => selectSource(id, "google")}
                                  query={submittedQuery}
                                />
                              )}
                            </div>
                          )}

                          {/* Custom model slots */}
                          {customSlotList
                            .filter((s) => s.answer.length > 0 || s.sources.length > 0 || s.isStreaming)
                            .map((slot) => {
                              const slotStep: StreamStep = slot.isStreaming
                                ? slot.sources.length === 0
                                  ? "searching"
                                  : Object.values(slot.verifications).some((v) => v.status === "checking")
                                    ? "verifying"
                                    : "generating"
                                : "searching";
                              return (
                                <div key={slot.model.id} className="flex flex-col">
                                  {slot.isStreaming && slot.sources.length === 0 && (
                                    <div className="mb-4 fade-up">
                                      <StreamingState query={submittedQuery} step={slotStep} />
                                    </div>
                                  )}
                                  {slot.error && <p className="mb-2 text-xs text-red-400">{slot.error}</p>}
                                  {(slot.answer || slot.sources.length > 0) && (
                                    <CustomSlotCard
                                      slot={slot}
                                      query={submittedQuery}
                                      onSelectSource={(id) => selectCustomSource(id, slot)}
                                    />
                                  )}
                                </div>
                              );
                            })}
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

                        {/* Llama result */}
                        {(hasResult || (isStreaming && sources.length > 0)) && (
                          <div className="mb-6">
                            <ResultCard
                              model="gemini"
                              answer={answer}
                              sources={sources}
                              verifications={verifications}
                              showQuery
                              isPrimary
                              isStreaming={isStreaming}
                              isSaved={!!savedId}
                              onSave={() => void handleSave()}
                              onShare={() => void handleShare()}
                              onSelectSource={(id) => selectSource(id, "gemini")}
                              onCompare={() => setShowAddModel(true)}
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

      {/* Pre-search comparison modal */}
      {pendingQuery && (
        <BeforeSearchModal
          query={pendingQuery}
          savedModels={savedCustomModels}
          onConfirm={(selectedIds) => confirmSearch(pendingQuery, selectedIds)}
          onAddModel={() => setShowAddModel(true)}
          onClose={() => setPendingQuery(null)}
        />
      )}

      {/* Add model modal */}
      {showAddModel && (
        <AddModelModal
          savedModels={savedCustomModels}
          onClose={() => setShowAddModel(false)}
          onSaved={setSavedCustomModels}
          onRun={(model) => void runCustomModel(model)}
          activeIds={activeCustomIds}
        />
      )}

      {/* Source detail overlay */}
      <SourceDetail
        source={detailSource}
        verification={detailVerif}
        onClose={() => { setDetailSource(null); setDetailVerif(undefined); }}
      />
    </>
  );
}

function BeforeSearchModal({
  query,
  savedModels,
  onConfirm,
  onAddModel,
  onClose,
}: {
  query: string;
  savedModels: CustomModel[];
  onConfirm: (selectedIds: string[]) => void;
  onAddModel: () => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Your query
            </p>
            <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-[var(--color-fg)]">
              {query}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>

        {/* Primary model */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Primary model
          </p>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ background: "var(--color-gemini)" }}
            />
            <span className="text-[13px] font-medium text-[var(--color-fg)]">
              Llama 3.3 · Groq
            </span>
            <span className="ml-auto rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-500 dark:text-emerald-400">
              free
            </span>
          </div>
        </div>

        {/* Compare with */}
        <div className="px-5 py-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Also compare with
          </p>

          {savedModels.length === 0 ? (
            <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
              No models added yet. Add a model to compare results side-by-side.
            </p>
          ) : (
            <div className="mb-3 space-y-2">
              {savedModels.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-ink-2)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    className="h-3.5 w-3.5 rounded accent-indigo-500"
                  />
                  <span className="text-[13px] text-[var(--color-fg)]">
                    {m.label}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[var(--color-text-muted)]">
                    {m.provider}
                  </span>
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onAddModel}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--color-border)] px-2.5 py-1.5 text-[12px] text-[var(--color-text-muted)] transition-colors hover:border-indigo-500/50 hover:text-indigo-400"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add comparison model
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedIds)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-indigo-400"
          >
            Search →
          </button>
        </div>
      </div>
    </div>
  );
}

// Card for a user-added custom model comparison slot
function CustomSlotCard({
  slot,
  query,
  onSelectSource,
}: {
  slot: { model: CustomModel; answer: string; sources: Source[]; verifications: Record<number, VerificationDisplay>; isStreaming: boolean };
  query: string;
  onSelectSource: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const getVerif = (id: number) => slot.verifications[id]?.status;

  return (
    <article className="fade-up relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]" style={{ borderLeftWidth: 2, borderLeftColor: "var(--color-checking)" }}>
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-checking)]" />
        <span className="font-heading text-[13px] font-semibold tracking-tight text-[var(--color-fg)]">
          {slot.model.label}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`} strokeWidth={2} />
          <span>{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
      {!collapsed && (
        <>
          {slot.sources.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {slot.sources.length} sources
              </p>
              <NewSourceStrip sources={slot.sources} getVerification={getVerif} onOpen={onSelectSource} />
            </div>
          )}
          {slot.answer ? (
            <div className="px-5 py-5 md:px-7 md:py-6">
              <MarkdownAnswer text={slot.answer} sources={slot.sources} getVerification={getVerif} onCite={onSelectSource} />
            </div>
          ) : slot.isStreaming ? (
            <div className="space-y-2 px-5 py-5 md:px-7 md:py-6">
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-ink-4)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--color-ink-4)]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--color-ink-4)]" />
            </div>
          ) : null}
        </>
      )}
    </article>
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
    googleAnswer?: string;
    googleSources?: Source[];
    googleVerifications?: Record<number, VerificationDisplay>;
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
      {turn.googleAnswer && (
        <div className="border-t border-[var(--color-border)]">
          <ResultCard
            nested
            model="google"
            answer={turn.googleAnswer}
            sources={turn.googleSources ?? []}
            verifications={turn.googleVerifications ?? {}}
            initialCollapsed={collapsed}
            onSelectSource={onSelectSource}
            query={turn.query}
          />
        </div>
      )}
    </div>
  );
}
