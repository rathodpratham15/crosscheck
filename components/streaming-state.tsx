"use client";

import { Search, Sparkles, ShieldCheck } from "lucide-react";

export type StreamStep = "searching" | "generating" | "verifying";

const STEPS = [
  {
    key: "searching",
    label: "Searching academic sources",
    Icon: Search,
    color: "#818CF8",
  },
  {
    key: "generating",
    label: "Generating synthesis",
    Icon: Sparkles,
    color: "#F59E0B",
  },
  {
    key: "verifying",
    label: "Verifying citations",
    Icon: ShieldCheck,
    color: "#10B981",
  },
] as const;

function stepIndex(s: StreamStep): number {
  return s === "searching" ? 0 : s === "generating" ? 1 : 2;
}

export function StreamingState({
  query,
  step,
}: {
  query: string;
  step: StreamStep;
}) {
  const current = stepIndex(step);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          Running
        </span>
        <span className="h-3 w-px bg-[var(--color-border)]" />
        <span className="truncate text-[13px] text-[var(--color-text-secondary)]">
          {query}
        </span>
      </div>
      <ol className="divide-y divide-[var(--color-border)]">
        {STEPS.map((s, i) => {
          const active = i === current;
          const done = i < current;
          const { Icon } = s;
          return (
            <li key={s.key} className="flex items-center gap-3 px-4 py-3">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border"
                style={{
                  borderColor:
                    done || active ? s.color : "var(--color-border)",
                  background: done ? `${s.color}1A` : "transparent",
                }}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  strokeWidth={1.75}
                  style={{
                    color:
                      done || active ? s.color : "var(--color-text-muted)",
                  }}
                />
              </span>
              <span
                className={`text-[13px] ${
                  active || done
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {s.label}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {active && (
                  <>
                    <span
                      className="dot-pulse h-1.5 w-1.5 rounded-full"
                      style={{ background: s.color, animationDelay: "0s" }}
                    />
                    <span
                      className="dot-pulse h-1.5 w-1.5 rounded-full"
                      style={{ background: s.color, animationDelay: "0.15s" }}
                    />
                    <span
                      className="dot-pulse h-1.5 w-1.5 rounded-full"
                      style={{ background: s.color, animationDelay: "0.3s" }}
                    />
                  </>
                )}
                {done && (
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    done
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
