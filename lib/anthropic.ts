import { anthropic } from "@ai-sdk/anthropic";
import type { Source } from "./tavily";

export const RESEARCH_MODEL = anthropic("claude-sonnet-4-6");

const SYSTEM_INSTRUCTION = `You are a research assistant for AI/ML topics. You are given a question and a numbered list of source snippets from academic sources (arxiv, Semantic Scholar, Papers with Code, GitHub).

Rules:
- Ground every claim in the provided sources. Do not invent citations or facts.
- Cite sources inline using square-bracketed numbers like [1], [2], [3].
- When multiple sources support a claim, cite them together as separate brackets like [1][3], not [1, 3].
- Never write "Source 1" or "[Source 1]" — use the bare [N] form only.
- If the sources do not contain enough information to answer, say so plainly and cite the sources that came closest.
- Answer concisely: 2–4 short paragraphs. Use markdown (bold, italic, lists) sparingly for clarity, not decoration.`;

export function buildResearchPrompt(query: string, sources: Source[]) {
  const sourcesBlock = sources
    .map(
      (s) => `[${s.id}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`,
    )
    .join("\n\n");

  return {
    system: SYSTEM_INSTRUCTION,
    user: `Question: ${query}\n\n---\n\nSources:\n${sourcesBlock}`,
  };
}
