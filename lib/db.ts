import type { VerificationDisplay } from "@/components/source-side-panel";
import type { Source } from "./tavily";
import { sql } from "./neon";

export type DbSaved = {
  id: string;
  query: string;
  answer: string;
  sources: Source[];
  verifications: Record<number, VerificationDisplay>;
  saved_at: number;
};

export async function getUserSaved(userId: string): Promise<DbSaved[]> {
  const rows = await sql`
    SELECT id, query, answer, sources, verifications, saved_at
    FROM cc_saved WHERE user_id = ${userId} ORDER BY saved_at DESC LIMIT 20`;
  return rows as DbSaved[];
}

export async function createSaved(
  userId: string,
  data: Omit<DbSaved, "id" | "saved_at">,
): Promise<DbSaved> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const savedAt = Date.now();
  const sourcesJson = JSON.stringify(data.sources);
  const verifJson = JSON.stringify(data.verifications);
  await sql`
    INSERT INTO cc_saved (id, user_id, query, answer, sources, verifications, saved_at)
    VALUES (${id}, ${userId}, ${data.query}, ${data.answer}, ${sourcesJson}::jsonb, ${verifJson}::jsonb, ${savedAt})
    ON CONFLICT (id) DO NOTHING`;
  return { ...data, id, saved_at: savedAt };
}

export async function deleteSavedDb(userId: string, id: string): Promise<void> {
  await sql`DELETE FROM cc_saved WHERE id = ${id} AND user_id = ${userId}`;
}

// ── Public shares ─────────────────────────────────────────────────────────────

export type DbShare = {
  id: string;
  query: string;
  answer: string;
  sources: Source[];
  verifications: Record<number, VerificationDisplay>;
  created_at: string;
};

export async function createShare(
  data: Omit<DbShare, "id" | "created_at">,
): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const sourcesJson = JSON.stringify(data.sources);
  const verifJson = JSON.stringify(data.verifications);
  await sql`
    INSERT INTO cc_shares (id, query, answer, sources, verifications)
    VALUES (${id}, ${data.query}, ${data.answer}, ${sourcesJson}::jsonb, ${verifJson}::jsonb)`;
  return id;
}

export async function getShare(id: string): Promise<DbShare | null> {
  const rows = await sql`
    SELECT id, query, answer, sources, verifications, created_at
    FROM cc_shares WHERE id = ${id}`;
  return rows.length ? (rows[0] as DbShare) : null;
}
