"use client";

import { useState } from "react";
import { X, Trash2, KeyRound, ChevronDown, Plus } from "lucide-react";
import {
  type CustomModel,
  type SupportedProvider,
  PROVIDER_LABELS,
  PROVIDER_SUGGESTIONS,
  saveCustomModel,
  deleteCustomModel,
} from "@/lib/custom-models";

const PROVIDERS: SupportedProvider[] = [
  "openai",
  "anthropic",
  "groq",
  "mistral",
  "xai",
  "deepseek",
  "openai-compatible",
];

const PROVIDER_COLORS: Record<SupportedProvider, string> = {
  openai: "#10b981",
  anthropic: "#94a3b8",
  groq: "#f59e0b",
  mistral: "#6366f1",
  xai: "#e5e7eb",
  deepseek: "#3b82f6",
  "openai-compatible": "#71717a",
};

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

type Props = {
  savedModels: CustomModel[];
  onClose: () => void;
  onSaved: (models: CustomModel[]) => void;
  onRun: (model: CustomModel) => void;
  activeIds: string[]; // model ids currently streaming / with results
};

export function AddModelModal({
  savedModels,
  onClose,
  onSaved,
  onRun,
  activeIds,
}: Props) {
  const [provider, setProvider] = useState<SupportedProvider>("openai");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.example.com/v1");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = PROVIDER_SUGGESTIONS[provider];

  function handleProviderChange(p: SupportedProvider) {
    setProvider(p);
    setModelId("");
    setShowSuggestions(false);
    setError(null);
  }

  function handleAdd() {
    setError(null);
    if (!modelId.trim()) {
      setError("Model name is required.");
      return;
    }
    if (!apiKey.trim()) {
      setError("API key is required.");
      return;
    }
    if (provider === "openai-compatible" && !baseUrl.trim()) {
      setError("Base URL is required for OpenAI-compatible endpoints.");
      return;
    }
    const model: CustomModel = {
      id: randomId(),
      label: label.trim() || `${PROVIDER_LABELS[provider]} · ${modelId.trim()}`,
      provider,
      modelId: modelId.trim(),
      apiKey: apiKey.trim(),
      baseUrl: provider === "openai-compatible" ? baseUrl.trim() : undefined,
    };
    saveCustomModel(model);
    const updated = [...savedModels, model];
    onSaved(updated);
    onRun(model);
    onClose();
  }

  function handleDelete(id: string) {
    deleteCustomModel(id);
    onSaved(savedModels.filter((m) => m.id !== id));
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-[480px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="font-heading text-[15px] font-semibold text-[var(--color-fg)]">
              Add a model
            </h2>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
              Your API key is sent directly in each request and never stored on
              our server.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Provider */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Provider
            </label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
                    provider === p
                      ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: PROVIDER_COLORS[p] }}
                  />
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL (openai-compatible only) */}
          {provider === "openai-compatible" && (
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Base URL
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:border-indigo-500/60 focus:outline-none"
              />
            </div>
          )}

          {/* Model */}
          <div className="relative">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Model
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={modelId}
                onChange={(e) => { setModelId(e.target.value); setShowSuggestions(false); }}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                placeholder={suggestions[0] ?? "model-name"}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:border-indigo-500/60 focus:outline-none"
              />
              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSuggestions((v) => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-ink-2)]"
                  aria-label="Show suggestions"
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setModelId(s); setShowSuggestions(false); }}
                    className="flex w-full items-center px-3 py-2 text-left text-[12.5px] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-ink-2)]"
                  >
                    <span className="font-mono">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <KeyRound className="h-3 w-3" strokeWidth={2} />
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-••••••••••••"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:border-indigo-500/60 focus:outline-none"
            />
          </div>

          {/* Label (optional) */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Display name{" "}
              <span className="lowercase tracking-normal text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={modelId ? `${PROVIDER_LABELS[provider]} · ${modelId}` : "My model"}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:border-indigo-500/60 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400">{error}</p>
          )}

          {/* Add button */}
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-indigo-400"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Save &amp; compare
          </button>
        </div>

        {/* Saved models */}
        {savedModels.length > 0 && (
          <div className="border-t border-[var(--color-border)] px-5 py-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Saved models
            </p>
            <div className="space-y-1.5">
              {savedModels.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PROVIDER_COLORS[m.provider] }}
                    />
                    <span className="truncate text-[12.5px] font-medium text-[var(--color-fg)]">
                      {m.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--color-text-muted)]">
                      {PROVIDER_LABELS[m.provider]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!activeIds.includes(m.id) && (
                      <button
                        type="button"
                        onClick={() => { onRun(m); onClose(); }}
                        className="rounded-md px-2 py-1 text-[11px] text-indigo-400 transition-colors hover:bg-indigo-500/10"
                      >
                        Compare →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
