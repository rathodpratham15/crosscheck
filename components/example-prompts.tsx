"use client";

const EXAMPLES = [
  "What is Luma AI?",
  "What is the chinchilla scaling law?",
  "How do mixture-of-experts models route tokens?",
  "Latest work on long-context multimodal models",
];

type ExamplePromptsProps = {
  onSelect: (query: string) => void;
};

export function ExamplePrompts({ onSelect }: ExamplePromptsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs tracking-wider text-zinc-500 uppercase">Try</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelect(q)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900 hover:shadow-md active:translate-y-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-200"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
