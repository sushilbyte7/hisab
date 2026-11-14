"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import type { z } from "zod";
import { loginSchema } from "@/lib/validations";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type LoginValues = z.infer<typeof loginSchema>;

/** Only allow same-origin relative paths as post-login destinations. */
function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = React.useState<string | null>(
    null,
  );
  const [resending, setResending] = React.useState(false);

  const next = safeNext(searchParams.get("next"));
  const verified = searchParams.get("verified") === "1";
  const paramError = searchParams.get("error");

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function resendVerification(email: string) {
    setResending(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (resendError) {
        toast.error(resendError.message);
        return;
      }
      toast.success("Verification email sent — check your inbox.");
      setUnconfirmedEmail(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not resend the email.",
      );
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(values: LoginValues) {
    setError(null);
    setUnconfirmedEmail(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInError) {
        setError(signInError.message);
        toast.error(signInError.message);
        // Unconfirmed accounts can't sign in — offer a fresh link instead
        // of leaving the user stuck with an expired one.
        if (/email not confirmed/i.test(signInError.message)) {
          setUnconfirmedEmail(values.email);
        }
        return;
      }
      toast.success("Signed in — welcome back.");
      router.push(next);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {verified && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Email verified — you can sign in now.
          </p>
        )}
        {paramError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {paramError}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {unconfirmedEmail && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resending}
            onClick={() => resendVerification(unconfirmedEmail)}
          >
            {resending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Resend verification email
          </Button>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          )}
          Sign in
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create account
          </Link>
        </p>
      </form>
    </Form>
  );
}
