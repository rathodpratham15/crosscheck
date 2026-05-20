"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 truncate max-w-[120px]">
          {session.user.email}
        </span>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
    >
      Sign in
    </Link>
  );
}
