import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, TriangleAlert } from "lucide-react";
import { DangerZone } from "@/components/settings/danger-zone";
import { PasswordForm } from "@/components/settings/password-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profile";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "Settings | Hisab",
  description: "Your profile, preferences, security, and data.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let profile: Profile | null = null;
  let loadError: string | null = null;
  try {
    profile = await getProfile(user.id);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load profile.";
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Your profile, preferences, security, and data.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              Couldn&apos;t load your profile
            </p>
            <p className="text-muted-foreground">
              {loadError} The forms below use default values; saving will
              still work.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name and avatar, shown across Hisab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} email={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            How dates, money, and the app itself look to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Change the password you sign in with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>
            Take your data with you, or remove it entirely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Export my data</p>
              <p className="text-sm text-muted-foreground">
                Download your profile, categories, transactions, and budgets
                as a JSON file.
              </p>
            </div>
            <Button asChild variant="outline">
              <a href="/api/export" download>
                <Download className="size-4" aria-hidden="true" />
                Export my data
              </a>
            </Button>
          </div>

          <Separator />

          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
