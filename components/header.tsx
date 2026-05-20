"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { Bookmark, Moon, Sun, LogOut, User } from "lucide-react";

export function Header() {
  const { theme, toggle } = useTheme();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isLoggedIn = status !== "loading" && !!session?.user;
  const initials = session?.user?.email?.[0].toUpperCase() ?? null;

  const dropdownMenu = open && (
    <div
      ref={menuRef}
      className="fixed right-4 top-14 z-[200] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-xl md:right-6"
      style={{ minWidth: "13rem" }}
    >
      {isLoggedIn && (
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <p className="truncate text-[11px] text-[var(--color-text-muted)]">
            {session.user!.email}
          </p>
        </div>
      )}

      {isLoggedIn && (
        <Link
          href="/saved"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
        >
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} />
          Saved
        </Link>
      )}

      {!isLoggedIn && (
        <Link
          href="/auth/signin"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
        >
          <User className="h-3.5 w-3.5" strokeWidth={1.75} />
          Sign in
        </Link>
      )}

      {isLoggedIn && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          Sign out
        </button>
      )}

    </div>
  );

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between pl-4 pr-4 md:pl-6 md:pr-6">
        <Link href="/" className="flex items-center gap-3 text-[var(--color-fg)]">
          <Logo />
          <span className="hidden h-4 w-px bg-[var(--color-border)] md:block" />
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] md:inline">
            verified AI research
          </span>
        </Link>

        <nav className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
          {isLoggedIn ? (
            <button
              ref={btnRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-[13px] font-semibold text-indigo-300 ring-1 ring-indigo-500/40 transition-colors hover:bg-indigo-500/30"
            >
              {initials}
            </button>
          ) : (
            <button
              ref={btnRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-ink-2)] hover:text-[var(--color-fg)]"
            >
              <User className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </nav>
      </div>

      {dropdownMenu}
    </header>
  );
}
