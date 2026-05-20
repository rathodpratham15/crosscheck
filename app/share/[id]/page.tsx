import Link from "next/link";
import { notFound } from "next/navigation";
import { getShare } from "@/lib/db";
import { Answer } from "@/components/answer";
import { SourceStrip } from "@/components/source-strip";

export const runtime = "nodejs";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();

  const date = new Date(share.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          ← crosscheck
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {share.query}
          </h1>
          <span className="shrink-0 text-xs text-zinc-400">{date}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Shared research snapshot · citations verified by crosscheck
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Claude
          </span>
        </div>
        <SourceStrip
          sources={share.sources}
          selectedId={null}
          onSelect={() => {}}
          getStatus={(sid) => share.verifications[sid]?.status}
        />
        <Answer
          text={share.answer}
          onCitationClick={() => {}}
          getCitationStatus={(sid) => share.verifications[sid]?.status}
        />
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          Run your own research →
        </Link>
      </div>
    </main>
  );
}
