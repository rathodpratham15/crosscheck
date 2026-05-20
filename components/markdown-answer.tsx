"use client";

import React from "react";
import type { Source } from "@/lib/tavily";
import type { CitationStatus } from "./citation-chip";

const VERIF_COLOR: Record<CitationStatus, string> = {
  verified: "#10B981",
  checking: "#F59E0B",
  unsupported: "#EF4444",
};

type Props = {
  text: string;
  sources: Source[];
  getVerification: (id: number) => CitationStatus | undefined;
  onCite: (id: number) => void;
};

export function MarkdownAnswer({ text, sources, getVerification, onCite }: Props) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="max-w-none text-[14.5px] leading-[1.75] text-[var(--color-fg)]">
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 last:mb-0">
          {renderInline(p, byId, getVerification, onCite)}
        </p>
      ))}
    </div>
  );
}

function renderInline(
  text: string,
  byId: Map<number, Source>,
  getVerification: (id: number) => CitationStatus | undefined,
  onCite: (id: number) => void,
) {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = regex.exec(text))) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const t = m[0];

    if (t.startsWith("**")) {
      tokens.push(
        <strong key={key++} className="font-semibold text-[var(--color-fg)]">
          {t.slice(2, -2)}
        </strong>,
      );
    } else if (t.startsWith("`")) {
      tokens.push(
        <code
          key={key++}
          className="rounded border border-[var(--color-border)] bg-[var(--color-ink-2)] px-1 py-0.5 font-mono text-[12px] text-indigo-300"
        >
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith("*")) {
      tokens.push(
        <em key={key++} className="text-[var(--color-text-secondary)]">
          {t.slice(1, -1)}
        </em>,
      );
    } else if (t.startsWith("[")) {
      const n = parseInt(t.slice(1, -1), 10);
      const status = getVerification(n);
      const color = status ? VERIF_COLOR[status] : "#A1A1AA";
      tokens.push(
        <button
          key={key++}
          type="button"
          onClick={() => byId.has(n) && onCite(n)}
          className="cite align-baseline"
          style={{ color }}
          aria-label={`Citation ${n}`}
        >
          <span style={{ color }}>{n}</span>
        </button>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}
