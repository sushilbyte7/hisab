import Link from "next/link";
import { ArrowLeftRight, IndianRupee, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Minimal static landing page. It must prerender with no session read
 * and no Supabase access: the proxy redirects "/" by session once
 * credentials exist, so this is the no-credentials fallback.
 */
export default function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IndianRupee className="size-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-tight">Hisab</span>
        </span>
        <Button variant="ghost" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Track money without the spreadsheet
        </div>
        <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Personal finance, sorted.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
          Hisab keeps your income, expenses and budgets in one calm place —
          so you always know where your money went.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/signup">Create account</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <PiggyBank className="size-4" aria-hidden />
          Budgets, categories and monthly insights — free to start.
        </p>
      </main>

      <footer className="px-6 pb-6 text-center text-xs text-muted-foreground">
        Hisab — your money, your record.
      </footer>
    </div>
  );
}
