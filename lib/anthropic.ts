import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { Source } from "./tavily";

export const RESEARCH_MODEL = anthropic("claude-sonnet-4-6");
export const VERIFIER_MODEL = anthropic("claude-haiku-4-5-20251001");
export const GPT_RESEARCH_MODEL = openai("gpt-4o-mini");

export const VerificationSchema = z.object({
  status: z.enum(["verified", "unsupported"]),
  reason: z.string(),
  quote: z.string(),
});
export type Verification = z.infer<typeof VerificationSchema>;

const SYSTEM_INSTRUCTION = `You are a research assistant for AI/ML topics. You are given a question and a numbered list of source snippets from academic sources (arxiv, Semantic Scholar, Papers with Code, GitHub).

Rules:
- Ground every claim in the provided sources. Do not invent citations or facts.
- Cite sources inline using square-bracketed numbers like [1], [2], [3].
- When multiple sources support a claim, cite them together as separate brackets like [1][3], not [1, 3].
- Never write "Source 1" or "[Source 1]" — use the bare [N] form only.
- If the sources do not contain enough information to answer, say so plainly and cite the sources that came closest.
- Answer concisely: 2–4 short paragraphs. Use markdown (bold, italic, lists) sparingly for clarity, not decoration.`;

export function buildResearchPrompt(
  query: string,
  sources: Source[],
  history?: { query: string; answer: string }[],
) {
  const sourcesBlock = sources
    .map(
      (s) => `[${s.id}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`,
    )
    .join("\n\n");

  let historyBlock = "";
  if (history && history.length > 0) {
    const turns = history
      .map((t, i) => `Q${i + 1}: ${t.query}\nA${i + 1}: ${t.answer}`)
      .join("\n\n");
    historyBlock = `Prior conversation (context only — citation numbers below refer to the new sources):\n\n${turns}\n\n---\n\n`;
  }

  return {
    system: SYSTEM_INSTRUCTION,
    user: `${historyBlock}Question: ${query}\n\n---\n\nSources:\n${sourcesBlock}`,
  };
}

const VERIFIER_INSTRUCTION = `You are a strict citation verifier. You receive a research answer that contains numbered citations like [N], and a single cited source with its content. Your job: locate the claims in the answer that cite [N], and determine if the source content directly supports those claims.

Rules:
- "verified" only if the source content directly contains the specific factual content being claimed.
- "unsupported" if the source is unrelated, contradicts the claim, is too vague, or merely topically adjacent.
- Loose reasoning like "this paper is about X so X must be true" is NOT enough. Be strict.
- If multiple claims cite this source and any one is unsupported, return "unsupported".
- "reason": one short sentence (<= 25 words) explaining the verdict. Reference the specific claim and source content.
- "quote": a verbatim excerpt (<= 30 words) from the source content that most directly supports the cited claim. Return an empty string if the status is "unsupported" or no specific excerpt applies.`;

export function buildVerificationPrompt(answer: string, source: Source): {
  system: string;
  user: string;
} {
  return {
    system: VERIFIER_INSTRUCTION,
    user: `ANSWER:\n${answer}\n\n---\n\nCITED SOURCE [${source.id}]:\nTitle: ${source.title}\nContent: ${source.snippet}`,
  };
}
