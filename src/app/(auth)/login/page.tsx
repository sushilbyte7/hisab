import { Suspense } from "react";
import type { Metadata } from "next";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Hisab",
  description: "Sign in to your Hisab account.",
};

/**
 * The form reads search params (?next=, ?verified=, ?error=), so it
 * must sit behind a Suspense boundary to keep the page prerenderable.
 */
export default function LoginPage() {
  return (
    <>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your Hisab account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </>
  );
}
