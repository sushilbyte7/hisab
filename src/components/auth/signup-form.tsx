"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, MailCheck, TriangleAlert } from "lucide-react";
import type { z } from "zod";
import { signupSchema } from "@/lib/validations";
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

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(
    null,
  );
  const [resending, setResending] = React.useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", email: "", password: "" },
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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not resend the email.",
      );
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(values: SignupValues) {
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.full_name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        toast.error(signUpError.message);
        return;
      }
      // Email confirmation is on by default: no session until the user
      // verifies. If confirmations are off, a session comes back at once.
      if (data.session) {
        toast.success("Account created — welcome to Hisab.");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setSubmittedEmail(values.email);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(message);
      toast.error(message);
    }
  }

  if (submittedEmail) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck
          className="mx-auto size-10 text-primary"
          aria-hidden
        />
        <p className="text-base font-medium">Check your email to verify your account</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{submittedEmail}</span>.
          Click the link to activate your account, then sign in.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Links work once and expire after an hour. If yours expired, send a
          fresh one below.
        </p>
        <Button
          variant="outline"
          className="w-full"
          disabled={resending}
          onClick={() => resendVerification(submittedEmail)}
        >
          {resending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Resend verification email
        </Button>
        <Button variant="ghost" className="w-full" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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
          Create account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
