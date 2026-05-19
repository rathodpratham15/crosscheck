import { Output, generateText, streamText } from "ai";
import {
  RESEARCH_MODEL,
  VERIFIER_MODEL,
  VerificationSchema,
  buildResearchPrompt,
  buildVerificationPrompt,
} from "@/lib/anthropic";
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

export async function POST(req: Request) {
  const { query, history } = (await req.json()) as {
    query?: string;
    history?: { query: string; answer: string }[];
  };

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return Response.json({ error: "query is required" }, { status: 400 });
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

  const result = streamText({
    model: RESEARCH_MODEL,
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
          });
        } catch {
          enqueue({
            type: "verification",
            citationId: id,
            status: "unsupported",
            reason: "Verification call failed; defaulting to unsupported.",
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
