import Link from "next/link";
import { IndianRupee } from "lucide-react";
import { UserMenu, type ShellUser } from "@/components/layout/user-menu";

/**
 * Sticky top bar for the dashboard shell. Server-compatible: the only
 * interactive part is the client <UserMenu /> on the right. The logo
 * shows on mobile only — desktop has the sidebar.
 */
export function DashboardHeader({ user }: { user: ShellUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 md:hidden"
        aria-label="Hisab dashboard"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <IndianRupee className="size-4" aria-hidden />
        </span>
        <span className="text-lg font-semibold tracking-tight">Hisab</span>
      </Link>
      <span className="hidden md:block" />
      <UserMenu user={user} />
    </header>
  );
}
