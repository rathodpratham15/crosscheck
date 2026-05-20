import { createShare } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json() as {
    query: string;
    answer: string;
    sources: unknown;
    verifications: unknown;
  };
  if (!body.query || !body.answer) {
    return Response.json({ error: "query and answer required" }, { status: 400 });
  }
  const id = await createShare({
    query: body.query,
    answer: body.answer,
    sources: body.sources as never,
    verifications: body.verifications as never,
  });
  return Response.json({ id }, { status: 201 });
}
