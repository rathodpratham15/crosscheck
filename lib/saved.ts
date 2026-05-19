import type { VerificationDisplay } from "@/components/source-side-panel";
import type { Source } from "./tavily";

const SAVED_KEY = "crosscheck-saved";
const MAX_SAVED = 20;

export type SavedConversation = {
  id: string;
  query: string;
  answer: string;
  sources: Source[];
  verifications: Record<number, VerificationDisplay>;
  savedAt: number;
};

export function loadSaved(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedConversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversation(
  conv: Omit<SavedConversation, "id" | "savedAt">,
): SavedConversation {
  const entry: SavedConversation = {
    ...conv,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: Date.now(),
  };
  const existing = loadSaved().filter((c) => c.query !== conv.query);
  const next = [entry, ...existing].slice(0, MAX_SAVED);
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  return entry;
}

export function deleteSaved(id: string): void {
  const next = loadSaved().filter((c) => c.id !== id);
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
}

export function isSaved(query: string): boolean {
  return loadSaved().some((c) => c.query === query);
}
