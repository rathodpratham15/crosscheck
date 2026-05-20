"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signIn("resend", { email: email.trim(), redirectTo: "/" });
    } catch {
      setError("Failed to send magic link. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 bg-grid">
      <div className="mx-auto flex min-h-[calc(100svh-56px)] max-w-sm flex-col justify-center px-6 py-16">
        <div className="mb-8">
          <h1 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-indigo-500/60"
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 text-center text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          ← Back to crosscheck
        </Link>
      </div>
    </main>
  );
}
