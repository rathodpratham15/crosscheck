export const runtime = "nodejs";

export type PaperDetails = {
  abstract: string | null;
  authors: string[];
  year: number | null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(url)}?fields=title,year,authors,abstract`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json(null);
    }

    const data = (await res.json()) as {
      abstract?: string;
      year?: number;
      authors?: { name: string }[];
    };

    const details: PaperDetails = {
      abstract: data.abstract ?? null,
      authors: (data.authors ?? []).map((a) => a.name).slice(0, 4),
      year: data.year ?? null,
    };

    return Response.json(details);
  } catch {
    return Response.json(null);
  }
}
