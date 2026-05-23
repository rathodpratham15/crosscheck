import { Output, generateText, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  GEMINI_RESEARCH_MODEL,
  GPT_RESEARCH_MODEL,
  GOOGLE_RESEARCH_MODEL,
  RESEARCH_MODEL,
  VERIFIER_MODEL,
  VerificationSchema,
  buildResearchPrompt,
  buildVerificationPrompt,
} from "@/lib/anthropic";
import type { SupportedProvider } from "@/lib/custom-models";
import { searchAcademic, type Source } from "@/lib/tavily";

export const runtime = "nodejs";

type Event =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "verification-start"; citationIds: number[] }
  | {
      type: "verification";
      citationId: number;
      status: "verified" | "unsupported";
      reason: string;
      quote: string;
    }
  | { type: "error"; message: string };

function encodeEvent(encoder: TextEncoder, event: Event): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

function extractCitedIds(answer: string, sources: Source[]): number[] {
  const sourceIds = new Set(sources.map((s) => s.id));
  const cited = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const id = Number(m[1]);
    if (sourceIds.has(id)) cited.add(id);
  }
  return [...cited].sort((a, b) => a - b);
}

function buildCustomModel(
  customProvider: SupportedProvider,
  modelId: string,
  apiKey: string,
  baseUrl?: string,
) {
  switch (customProvider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "groq":
      return createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey })(modelId);
    case "mistral":
      return createOpenAI({ baseURL: "https://api.mistral.ai/v1", apiKey })(modelId);
    case "xai":
      return createOpenAI({ baseURL: "https://api.x.ai/v1", apiKey })(modelId);
    case "deepseek":
      return createOpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey })(modelId);
    case "openai-compatible":
      return createOpenAI({ baseURL: baseUrl, apiKey })(modelId);
    case "openai":
    default:
      return createOpenAI({ apiKey })(modelId);
  }
}

export async function POST(req: Request) {
  const { query, history, provider, customProvider, modelId, apiKey, baseUrl } =
    (await req.json()) as {
      query?: string;
      history?: { query: string; answer: string }[];
      provider?: "claude" | "gpt" | "gemini" | "google" | "custom";
      customProvider?: SupportedProvider;
      modelId?: string;
      apiKey?: string;
      baseUrl?: string;
    };

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  if (provider === "custom") {
    if (!customProvider || !modelId || !apiKey) {
      return Response.json(
        { error: "customProvider, modelId, and apiKey are required for custom models." },
        { status: 400 },
      );
    }
    if (customProvider === "openai-compatible" && !baseUrl) {
      return Response.json(
        { error: "baseUrl is required for openai-compatible providers." },
        { status: 400 },
      );
    }
  }

  let sources: Source[];
  try {
    sources = await searchAcademic(query);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }

  const { system, user } = buildResearchPrompt(query, sources, history);

  if (provider === "gpt" && !process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY is not configured on this server." }, { status: 503 });
  }
  if (provider === "gemini" && !process.env.GROQ_API_KEY) {
    return Response.json({ error: "GROQ_API_KEY is not configured on this server." }, { status: 503 });
  }
  if (provider === "google" && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured on this server." }, { status: 503 });
  }

  const researchModel =
    provider === "gpt"
      ? GPT_RESEARCH_MODEL
      : provider === "gemini"
        ? GEMINI_RESEARCH_MODEL
        : provider === "google"
          ? GOOGLE_RESEARCH_MODEL
          : provider === "custom"
            ? buildCustomModel(customProvider!, modelId!, apiKey!, baseUrl)
            : RESEARCH_MODEL;

  const result = streamText({
    model: researchModel,
    system,
    prompt: user,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: Event) =>
        controller.enqueue(encodeEvent(encoder, event));

      enqueue({ type: "sources", sources });

      let fullAnswer = "";
      try {
        for await (const delta of result.textStream) {
          fullAnswer += delta;
          enqueue({ type: "delta", text: delta });
        }
      } catch (err) {
        enqueue({
          type: "error",
          message: err instanceof Error ? err.message : "Stream failed",
        });
        controller.close();
        return;
      }

      const citedIds = extractCitedIds(fullAnswer, sources);
      if (citedIds.length === 0) {
        controller.close();
        return;
      }

      enqueue({ type: "verification-start", citationIds: citedIds });

      const verifications = citedIds.map(async (id) => {
        const source = sources.find((s) => s.id === id);
        if (!source) return;
        try {
          const verifyPrompt = buildVerificationPrompt(fullAnswer, source);
          const { output } = await generateText({
            model: VERIFIER_MODEL,
            output: Output.object({ schema: VerificationSchema }),
            system: verifyPrompt.system,
            prompt: verifyPrompt.user,
          });
          enqueue({
            type: "verification",
            citationId: id,
            status: output.status,
            reason: output.reason,
            quote: output.quote,
          });
        } catch {
          enqueue({
            type: "verification",
            citationId: id,
            status: "unsupported",
            reason: "Verification call failed; defaulting to unsupported.",
            quote: "",
          });
        }
      });

      await Promise.all(verifications);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
