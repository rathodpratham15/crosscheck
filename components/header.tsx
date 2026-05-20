"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { Bookmark, Moon, Sun } from "lucide-react";

export function Header() {
  const { theme, toggle } = useTheme();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 text-[var(--color-fg)]"
        >
          <Logo />
          <span className="hidden h-4 w-px bg-[var(--color-border)] md:block" />
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] md:inline">
            verified AI research
          </span>
        </Link>

        <nav className="flex items-center gap-1.5">
          <Link
            href="/saved"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
          >
            <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Saved</span>
          </Link>

          {status !== "loading" && (
            session?.user ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden max-w-[140px] truncate text-xs text-[var(--color-fg-muted)] sm:inline">
                  {session.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-md px-2.5 py-1.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="hidden rounded-md px-2.5 py-1.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)] sm:inline-flex"
              >
                Sign in
              </Link>
            )
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
