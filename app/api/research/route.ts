import { streamText } from "ai";
import { RESEARCH_MODEL, buildResearchPrompt } from "@/lib/anthropic";
import { searchAcademic, type Source } from "@/lib/tavily";

export const runtime = "nodejs";

type Event =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "error"; message: string };

function encodeEvent(encoder: TextEncoder, event: Event): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query?: string };

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

  const { system, user } = buildResearchPrompt(query, sources);

  const result = streamText({
    model: RESEARCH_MODEL,
    system,
    prompt: user,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeEvent(encoder, { type: "sources", sources }));

      try {
        for await (const delta of result.textStream) {
          controller.enqueue(encodeEvent(encoder, { type: "delta", text: delta }));
        }
      } catch (err) {
        controller.enqueue(
          encodeEvent(encoder, {
            type: "error",
            message: err instanceof Error ? err.message : "Stream failed",
          }),
        );
      } finally {
        controller.close();
      }
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
