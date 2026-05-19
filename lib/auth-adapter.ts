import type { Adapter, AdapterUser, AdapterSession, VerificationToken } from "next-auth/adapters";
import { sql } from "./neon";

function rowToUser(row: Record<string, unknown>): AdapterUser {
  return {
    id: row.id as string,
    name: (row.name as string) ?? null,
    email: row.email as string,
    emailVerified: row.email_verified ? new Date(row.email_verified as string) : null,
    image: (row.image as string) ?? null,
  };
}

function rowToSession(row: Record<string, unknown>): AdapterSession {
  return {
    sessionToken: row.session_token as string,
    userId: row.user_id as string,
    expires: new Date(row.expires as string),
  };
}

export const NeonAdapter: Adapter = {
  async createUser(user) {
    const id = crypto.randomUUID();
    const name = user.name ?? null;
    const ev = user.emailVerified ?? null;
    const image = user.image ?? null;
    const rows = await sql`
      INSERT INTO cc_users (id, name, email, email_verified, image)
      VALUES (${id}, ${name}, ${user.email}, ${ev}, ${image}) RETURNING *`;
    return rowToUser(rows[0] as Record<string, unknown>);
  },

  async getUser(id) {
    const rows = await sql`SELECT * FROM cc_users WHERE id = ${id}`;
    return rows.length ? rowToUser(rows[0] as Record<string, unknown>) : null;
  },

  async getUserByEmail(email) {
    const rows = await sql`SELECT * FROM cc_users WHERE email = ${email}`;
    return rows.length ? rowToUser(rows[0] as Record<string, unknown>) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    void provider; void providerAccountId;
    return null;
  },

  async updateUser(user) {
    const name = user.name ?? null;
    const ev = user.emailVerified ?? null;
    const image = user.image ?? null;
    const rows = await sql`
      UPDATE cc_users SET name=${name}, email=${user.email}, email_verified=${ev}, image=${image}
      WHERE id=${user.id} RETURNING *`;
    return rowToUser(rows[0] as Record<string, unknown>);
  },

  async deleteUser(userId) {
    await sql`DELETE FROM cc_users WHERE id = ${userId}`;
  },

  async linkAccount(account) { void account; },

  async createSession(session) {
    const exp = session.expires.toISOString();
    await sql`
      INSERT INTO cc_sessions (session_token, user_id, expires)
      VALUES (${session.sessionToken}, ${session.userId}, ${exp})`;
    return session;
  },

  async getSessionAndUser(sessionToken) {
    const rows = await sql`
      SELECT s.session_token, s.user_id, s.expires,
             u.id, u.name, u.email, u.email_verified, u.image
      FROM cc_sessions s JOIN cc_users u ON u.id = s.user_id
      WHERE s.session_token = ${sessionToken} AND s.expires > NOW()`;
    if (!rows.length) return null;
    const row = rows[0] as Record<string, unknown>;
    return { session: rowToSession(row), user: rowToUser(row) };
  },

  async updateSession(session) {
    const exp = session.expires?.toISOString();
    const rows = await sql`
      UPDATE cc_sessions SET expires=${exp} WHERE session_token=${session.sessionToken} RETURNING *`;
    return rows.length ? rowToSession(rows[0] as Record<string, unknown>) : null;
  },

  async deleteSession(sessionToken) {
    await sql`DELETE FROM cc_sessions WHERE session_token = ${sessionToken}`;
  },

  async createVerificationToken(token) {
    const exp = token.expires.toISOString();
    await sql`
      INSERT INTO cc_verification_tokens (identifier, token, expires)
      VALUES (${token.identifier}, ${token.token}, ${exp})`;
    return token;
  },

  async useVerificationToken({ identifier, token }) {
    const rows = await sql`
      DELETE FROM cc_verification_tokens
      WHERE identifier=${identifier} AND token=${token} RETURNING *`;
    if (!rows.length) return null;
    const row = rows[0] as Record<string, unknown>;
    return {
      identifier: row.identifier as string,
      token: row.token as string,
      expires: new Date(row.expires as string),
    } satisfies VerificationToken;
  },
};
