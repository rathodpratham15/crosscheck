import Link from "next/link";
import { notFound } from "next/navigation";
import { getShare } from "@/lib/db";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { NewSourceStrip } from "@/components/source-pill";

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
    <main className="flex-1 bg-grid">
      <div className="mx-auto max-w-[860px] px-5 py-10 md:px-8">
        <div className="mb-8">
          <div className="mt-4 flex items-start justify-between gap-4">
            <h1 className="font-heading text-[20px] font-semibold tracking-tight text-[var(--color-fg)]">
              {share.query}
            </h1>
            <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-muted)]">
              {date}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
            Shared research snapshot · citations verified by crosscheck
          </p>
        </div>

        <article
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]"
          style={{ borderLeftWidth: 2, borderLeftColor: "var(--color-claude)" }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ background: "var(--color-claude)" }}
            />
            <span className="font-heading text-[13px] font-semibold text-[var(--color-fg)]">
              Claude Sonnet
            </span>
          </div>

          {share.sources.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <NewSourceStrip
                sources={share.sources}
                getVerification={(sid) =>
                  share.verifications[sid]?.status
                }
                onOpen={() => {}}
              />
            </div>
          )}

          <div className="px-5 py-5 md:px-7 md:py-6">
            <MarkdownAnswer
              text={share.answer}
              sources={share.sources}
              getVerification={(sid) => share.verifications[sid]?.status}
              onCite={() => {}}
            />
          </div>
        </article>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
          >
            Run your own research →
          </Link>
        </div>
      </div>
    </main>
  );
}
