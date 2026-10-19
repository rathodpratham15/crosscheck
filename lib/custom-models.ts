export type SupportedProvider =
  | "openai"
  | "anthropic"
  | "groq"
  | "mistral"
  | "xai"
  | "deepseek"
  | "openai-compatible";

export type CustomModel = {
  id: string;
  label: string;
  provider: SupportedProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string; // only for openai-compatible
};

export const PROVIDER_LABELS: Record<SupportedProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  groq: "Groq",
  mistral: "Mistral",
  xai: "xAI Grok",
  deepseek: "DeepSeek",
  "openai-compatible": "OpenAI-compatible",
};

export const PROVIDER_BASE_URLS: Partial<Record<SupportedProvider, string>> = {
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  xai: "https://api.x.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
};

export const PROVIDER_SUGGESTIONS: Record<SupportedProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o1-mini", "o3-mini"],
  anthropic: [
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
  groq: [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
  ],
  mistral: [
    "mistral-large-latest",
    "mistral-small-latest",
    "codestral-latest",
    "open-mistral-nemo",
  ],
  xai: ["grok-3", "grok-3-mini", "grok-2-1212"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  "openai-compatible": [],
};

const STORAGE_KEY = "crosscheck-custom-models";

export function loadCustomModels(): CustomModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomModel[];
  } catch {
    return [];
  }
}

export function saveCustomModel(model: CustomModel): void {
  const existing = loadCustomModels().filter((m) => m.id !== model.id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, model]));
  } catch {}
}

export function deleteCustomModel(id: string): void {
  const models = loadCustomModels().filter((m) => m.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  } catch {}
}
