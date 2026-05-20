import Link from "next/link";

export default function VerifyPage() {
  return (
    <main className="flex-1 bg-grid">
      <div className="mx-auto flex min-h-[calc(100svh-56px)] max-w-sm flex-col justify-center px-6 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-2xl">
            ✉️
          </span>
        </div>
        <h1 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--color-fg)]">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          We sent a magic link to your inbox. Click it to sign in — it expires
          in 24 hours.
        </p>
        <Link
          href="/"
          className="mt-8 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          ← Back to crosscheck
        </Link>
      </div>
    </main>
  );
}
