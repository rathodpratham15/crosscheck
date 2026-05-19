import { Fragment } from "react";

export type ResearchStep = "searching" | "generating" | "verifying";

const STEPS: { key: ResearchStep; label: string }[] = [
  { key: "searching", label: "Searching" },
  { key: "generating", label: "Generating" },
  { key: "verifying", label: "Verifying" },
];

export function ResearchProgress({ step }: { step: ResearchStep }) {
  const activeIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {STEPS.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && (
            <span className="text-zinc-300 dark:text-zinc-700">→</span>
          )}
          <span
            className={
              i < activeIdx
                ? "text-zinc-400 line-through dark:text-zinc-600"
                : i === activeIdx
                  ? "animate-pulse font-medium text-zinc-700 dark:text-zinc-200"
                  : "text-zinc-300 dark:text-zinc-700"
            }
          >
            {s.label}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
