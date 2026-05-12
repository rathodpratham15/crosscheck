"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim() || isStreaming) return;

    setAnswer("");
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
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">crosscheck</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Citation-grounded research assistant for AI/ML.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about AI/ML research…"
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
          disabled={isStreaming}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isStreaming || !query.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isStreaming ? "Streaming…" : "Ask"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {answer && (
        <article className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950">
          {answer}
        </article>
      )}
    </main>
  );
}
