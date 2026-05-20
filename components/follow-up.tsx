"use client";

import { CornerDownLeft } from "lucide-react";
import { useState } from "react";

export function FollowUpComposer({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [v, setV] = useState("");

  const submit = () => {
    const q = v.trim();
    if (!q) return;
    onSubmit(q);
    setV("");
  };

  return (
    <div className="flex items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-2 transition-colors focus-within:border-indigo-500/40">
      <textarea
        rows={1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Follow up…"
        className="block w-full resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!v.trim()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-ink-2)] px-2.5 py-1.5 text-[12px] text-[var(--color-fg)] transition-colors hover:border-indigo-500/40 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>Follow up</span>
        <CornerDownLeft className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}
