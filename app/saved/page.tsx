"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { loadSaved, deleteSaved, type SavedConversation } from "@/lib/saved";
import type { DbSaved } from "@/lib/db";

type Item = {
  id: string;
  query: string;
  answer: string;
  sources: unknown[];
  savedAt: number;
};

function toItem(c: SavedConversation): Item {
  return {
    id: c.id,
    query: c.query,
    answer: c.answer,
    sources: c.sources,
    savedAt: c.savedAt,
  };
}

function toItemFromDb(c: DbSaved): Item {
  return {
    id: c.id,
    query: c.query,
    answer: c.answer,
    sources: c.sources,
    savedAt: c.saved_at,
  };
}

export default function SavedPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [isCloud, setIsCloud] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/saved");
        if (res.ok) {
          const data = (await res.json()) as DbSaved[];
          setItems(data.map(toItemFromDb));
          setIsCloud(true);
          return;
        }
      } catch {}
      setItems(loadSaved().map(toItem));
      setIsCloud(false);
    }
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (isCloud) {
      await fetch(`/api/saved/${id}`, { method: "DELETE" });
    } else {
      deleteSaved(id);
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <main className="flex-1 bg-grid">
      <div className="mx-auto max-w-[860px] px-5 py-10 md:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
              Saved
            </h1>
            {isCloud && (
              <p className="mt-0.5 font-mono text-[11px] text-indigo-400">
                Synced to your account
              </p>
            )}
          </div>
          {items.length > 0 && (
            <span className="font-mono text-[12px] text-[var(--color-text-muted)]">
              {items.length} saved
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              No saved conversations yet.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300"
            >
              Start a research session →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-5 py-4 transition-colors hover:border-[var(--color-line-strong)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/?q=${encodeURIComponent(item.query)}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-[14px] font-medium text-[var(--color-fg)] transition-colors group-hover:text-indigo-300">
                      {item.query}
                    </p>
                    <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-[var(--color-text-muted)]">
                      <span>
                        {Array.isArray(item.sources) ? item.sources.length : 0}{" "}
                        sources
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(item.savedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                      {String(item.answer)
                        .replace(/\[\d+\]/g, "")
                        .trim()}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    aria-label="Delete saved conversation"
                    className="shrink-0 rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
