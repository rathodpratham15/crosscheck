"use client";

import { useState } from "react";
import { Answer } from "@/components/answer";
import type { CitationStatus } from "@/components/citation-chip";
import { ExamplePrompts } from "@/components/example-prompts";
import { SearchingIndicator } from "@/components/searching-indicator";
import {
  SourceSidePanel,
  type VerificationDisplay,
} from "@/components/source-side-panel";
import { SourceStrip } from "@/components/source-strip";
import type { Source } from "@/lib/tavily";

const MIN_QUERY_LENGTH = 5;

type ServerEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "verification-start"; citationIds: number[] }
  | {
      type: "verification";
      citationId: number;
      status: "verified" | "unsupported";
      reason: string;
    }
  | { type: "error"; message: string };

export default function Home() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [verifications, setVerifications] = useState<
    Record<number, VerificationDisplay>
  >({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (query.trim().length < MIN_QUERY_LENGTH || isStreaming) return;

    setAnswer("");
    setSources([]);
    setSelectedSourceId(null);
    setVerifications({});
    setError(null);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
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

          if (event.type === "sources") {
            setSources(event.sources);
          } else if (event.type === "delta") {
            setAnswer((prev) => prev + event.text);
          } else if (event.type === "verification-start") {
            setVerifications((prev) => {
              const next = { ...prev };
              for (const id of event.citationIds) {
                next[id] = { status: "checking" };
              }
              return next;
            });
          } else if (event.type === "verification") {
            setVerifications((prev) => ({
              ...prev,
              [event.citationId]: {
                status: event.status,
                reason: event.reason,
              },
            }));
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }

  const hasResult = answer.length > 0 || sources.length > 0;
  const selectedSource =
    sources.find((s) => s.id === selectedSourceId) ?? null;
  const getStatus = (id: number): CitationStatus | undefined =>
    verifications[id]?.status;
  const selectedVerification =
    selectedSource ? verifications[selectedSource.id] : undefined;
  // Keep "centered" layout for empty + error states (no result yet); switch to
  // top-aligned only once we have something to show.
  const isEmpty = !hasResult && !isStreaming;
  const trimmedLen = query.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < MIN_QUERY_LENGTH;

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
          void handleSubmit();
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
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

      {!hasResult && !isStreaming && !error && (
        <ExamplePrompts onSelect={setQuery} />
      )}

      {isStreaming && sources.length === 0 && (
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

      {hasResult && (
        <section className="animate-fade-in min-w-0 rounded-lg border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
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
        </section>
      )}

      <SourceSidePanel
        source={selectedSource}
        verification={selectedVerification}
        onClose={() => setSelectedSourceId(null)}
      />
    </main>
  );
}
