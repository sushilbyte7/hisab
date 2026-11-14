import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { ShellUser } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * With cacheComponents on, this layout opts out of instant navigation
 * so it can read the session server-side on every request.
 */
export const instant = false;

function ShellSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The profile row is created by a trigger on signup; if it is missing
  // (trigger lag, older account), proceed with nulls instead of crashing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, theme")
    .eq("id", user.id)
    .maybeSingle();

  const shellUser: ShellUser = {
    name: profile?.full_name ?? null,
    email: user.email ?? "",
    avatarUrl: profile?.avatar_url ?? null,
  };

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar user={shellUser} />
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <DashboardHeader user={shellUser} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10">
          <Suspense fallback={<ShellSkeleton />}>{children}</Suspense>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
