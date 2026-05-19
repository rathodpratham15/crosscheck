import { Output, generateText } from "ai";
import { SuggestionsSchema, VERIFIER_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { query, answer } = (await req.json()) as {
    query?: string;
    answer?: string;
  };
  if (!query || !answer) {
    return Response.json({ suggestions: [] });
  }

  try {
    const { output } = await generateText({
      model: VERIFIER_MODEL,
      output: Output.object({ schema: SuggestionsSchema }),
      system:
        "Generate exactly 4 specific follow-up research questions based on the given question and answer. Each question should explore a related subtopic, dig deeper into a mentioned concept, or examine an adjacent area. Be concise and specific — no more than 15 words each.",
      prompt: `Question: ${query}\n\nAnswer: ${answer.slice(0, 800)}`,
    });
    return Response.json({ suggestions: output.questions.slice(0, 4) });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
