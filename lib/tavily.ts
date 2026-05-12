import { tavily, type TavilyClient } from "@tavily/core";

const ACADEMIC_DOMAINS = [
  "arxiv.org",
  "semanticscholar.org",
  "paperswithcode.com",
  "github.com",
] as const;

export type Source = {
  id: number;
  title: string;
  url: string;
  snippet: string;
  score: number;
};

let cachedClient: TavilyClient | null = null;

function getClient(): TavilyClient {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set");
  }
  if (!cachedClient) {
    cachedClient = tavily({ apiKey });
  }
  return cachedClient;
}

export async function searchAcademic(query: string): Promise<Source[]> {
  const client = getClient();
  const response = await client.search(query, {
    includeDomains: [...ACADEMIC_DOMAINS],
    maxResults: 6,
    searchDepth: "basic",
  });

  return response.results.map((r, i) => ({
    id: i + 1,
    title: r.title,
    url: r.url,
    snippet: r.content,
    score: r.score,
  }));
}
