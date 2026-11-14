import Link from "next/link";
import { IndianRupee } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Centered auth layout. Static — no session read here (the proxy
 * already redirects signed-in users away from /login and /signup).
 * Each auth page renders its own CardHeader/CardContent inside the card.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-foreground"
        aria-label="Hisab home"
      >
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <IndianRupee className="size-5" aria-hidden />
        </span>
        <span className="text-2xl font-semibold tracking-tight">Hisab</span>
      </Link>
      <Card className="w-full max-w-md">{children}</Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Your money, your record.
      </p>
    </div>
  );
}
