import type { Metadata } from "next";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account — Hisab",
  description: "Create your Hisab account.",
};

export default function SignupPage() {
  return (
    <>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start tracking your money in a couple of minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </>
  );
}
