"use client";

import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { AnimatedVerifyLogo } from "@/components/animated-verify-logo";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signIn("resend", { email: email.trim(), redirectTo: "/" });
      setSent(true);
    } catch {
      setError("Failed to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-56px)]">
      {/* ── Left panel — illustration ── */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden border-r border-[var(--color-border)] bg-indigo-50 px-12 py-16 dark:bg-[var(--color-bg-elev)] md:flex md:w-[52%]">
        {/* Soft radial glow behind illustration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 55%, rgba(99,102,241,0.08) 0%, transparent 100%)",
          }}
        />

        <div className="relative flex flex-col items-center gap-10">
          <Image
            src="/sent-blue.svg"
            alt="Sign in illustration"
            width={380}
            height={380}
            priority
            className="select-none dark:hidden"
          />
          <Image
            src="/sent-black.svg"
            alt="Sign in illustration"
            width={380}
            height={380}
            priority
            className="hidden select-none dark:block"
          />

          <div className="text-center">
            <p className="font-heading text-[20px] font-semibold tracking-tight text-[var(--color-fg)]">
              Research with confidence
            </p>
            <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">
              Every citation verified against its source. Compare answers across multiple AI models side-by-side.
            </p>

            {/* Feature pills */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Verified citations", "Multi-model", "Free with gpt-oss"].map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-mono text-[10.5px] text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-[380px]">
          {/* Logo + headline */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <AnimatedVerifyLogo size={52} />
            <div>
              <h1 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
                Sign in to crosscheck
              </h1>
              <p className="mt-1 text-[13.5px] text-[var(--color-text-muted)]">
                We&apos;ll email you a magic link — no password needed.
              </p>
            </div>
          </div>

          {sent ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-5 py-6 text-center">
              <p className="text-[15px] font-medium text-[var(--color-fg)]">
                Check your inbox
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                We sent a magic link to{" "}
                <span className="text-[var(--color-fg)]">{email}</span>.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-5 py-5"
            >
              <label
                htmlFor="email"
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
              >
                Email
              </label>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 transition-colors focus-within:border-indigo-500/60">
                <Mail
                  className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]"
                  strokeWidth={1.75}
                />
                <input
                  id="email"
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="block w-full bg-transparent py-2.5 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                />
              </div>

              {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
              >
                <span>{loading ? "Sending…" : "Send magic link"}</span>
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </form>
          )}

          <Link
            href="/"
            className="mt-6 block text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            ← Back to crosscheck
          </Link>
        </div>
      </div>
    </div>
  );
}
