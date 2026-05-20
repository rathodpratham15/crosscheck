import { auth } from "@/auth";
import { deleteSavedDb } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteSavedDb(session.user.id, id);
  return new Response(null, { status: 204 });
}
