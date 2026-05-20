import Link from "next/link";

export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16 text-center">
      <div className="mb-4 flex justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl dark:bg-indigo-950">
          ✉️
        </span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-zinc-500">
        We sent a magic link to your inbox. Click it to sign in — it expires in 24 hours.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        ← Back to crosscheck
      </Link>
    </main>
  );
}
