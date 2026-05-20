import { auth } from "@/auth";
import { createSaved, getUserSaved } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await getUserSaved(session.user.id);
  return Response.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json() as {
    query: string;
    answer: string;
    sources: unknown;
    verifications: unknown;
  };
  const entry = await createSaved(session.user.id, {
    query: body.query,
    answer: body.answer,
    sources: body.sources as never,
    verifications: body.verifications as never,
  });
  return Response.json(entry, { status: 201 });
}
