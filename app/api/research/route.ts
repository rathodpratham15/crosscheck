import { streamText } from "ai";
import { RESEARCH_MODEL, RESEARCH_SYSTEM_PROMPT } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query?: string };

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const result = streamText({
    model: RESEARCH_MODEL,
    system: RESEARCH_SYSTEM_PROMPT,
    prompt: query,
  });

  return result.toTextStreamResponse();
}
