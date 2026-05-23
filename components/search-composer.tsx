"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Plus, Sparkles } from "lucide-react";

type Props = {
  onSubmit: (q: string) => void;
  busy?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
  onAddModel?: () => void;
};

export function SearchComposer({
  onSubmit,
  busy,
  value,
  onChange,
  placeholder = "Ask anything about AI/ML research…",
  compact,
  onAddModel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!compact) ref.current?.focus();
  }, [compact]);

  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    onSubmit(q);
  };

  return (
    <div
      className={`relative w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] transition-colors focus-within:border-indigo-500/60 ${
        compact ? "" : "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]"
      }`}
    >
      <textarea
        ref={ref}
        rows={compact ? 1 : 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        disabled={busy}
      />
      {compact ? (
        /* Compact footer: single tight row for sidebar */
        <div className="flex items-center gap-1.5 border-t border-[var(--color-border)] px-2 py-1.5">
          <Sparkles className="h-3 w-3 shrink-0 text-indigo-400" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--color-text-muted)]">
            Claude · GPT · Gemini · Llama
          </span>
          {onAddModel && (
            <button
              type="button"
              onClick={onAddModel}
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-500 transition-colors hover:bg-indigo-500/20 dark:text-indigo-400"
            >
              <Plus className="h-2.5 w-2.5" strokeWidth={2.5} />
              Add
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || !value.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-[var(--color-ink-3)] disabled:text-[var(--color-text-muted)]"
            aria-label={busy ? "Asking…" : "Ask"}
          >
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : (
        /* Full footer: model list + shortcut hint + labeled Ask button */
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
            <Sparkles className="h-3 w-3 text-indigo-400" strokeWidth={1.75} />
            <span className="font-mono">Claude · GPT · Gemini · Llama</span>
            {onAddModel && (
              <button
                type="button"
                onClick={onAddModel}
                className="inline-flex items-center gap-0.5 rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-500 transition-colors hover:bg-indigo-500/20 dark:text-indigo-400"
              >
                <Plus className="h-2.5 w-2.5" strokeWidth={2.5} />
                Add
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-ink-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)] sm:inline-flex">
              ⌘ ↵
            </kbd>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !value.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-[var(--color-ink-3)] disabled:text-[var(--color-text-muted)]"
            >
              <span>{busy ? "Asking…" : "Ask"}</span>
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
