"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteSaved, loadSaved, type SavedConversation } from "@/lib/saved";

export default function SavedPage() {
  const [items, setItems] = useState<SavedConversation[]>([]);

  useEffect(() => {
    setItems(loadSaved());
  }, []);

  function handleDelete(id: string) {
    deleteSaved(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ← crosscheck
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Saved conversations
          </h1>
        </div>
        {items.length > 0 && (
          <span className="text-sm text-zinc-400">{items.length} saved</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">No saved conversations yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Start a research session →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="group rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-4">
                <Link
                  href={`/?q=${encodeURIComponent(item.query)}`}
                  className="flex-1 min-w-0"
                >
                  <p className="truncate text-sm font-medium text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                    {item.query}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                    <span>{item.sources.length} sources</span>
                    <span>·</span>
                    <span>
                      {new Date(item.savedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {item.answer.replace(/\[\d+\]/g, "").trim()}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label="Delete saved conversation"
                  className="shrink-0 rounded p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-500 dark:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
