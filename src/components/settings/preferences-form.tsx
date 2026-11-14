"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updateProfile } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, type DateFormat } from "@/lib/finance";
import type { Profile, ThemePreference } from "@/types/database";

// Standalone schema (not profileFormSchema.pick): the shared schema's
// `currency` has `.default("INR")`, which makes its input type optional
// and breaks the zodResolver/useForm type match. The server action
// still validates the full profileFormSchema on submit.
const preferencesSchema = z.object({
  currency: z.string(),
  date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  theme: z.enum(["dark", "light"]),
});

type PreferencesValues = z.infer<typeof preferencesSchema>;

const DATE_FORMATS: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

interface PreferencesFormProps {
  profile: Profile | null;
}

export function PreferencesForm({ profile }: PreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const { setTheme } = useTheme();

  const form = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      currency: profile?.currency ?? "INR",
      date_format: profile?.date_format ?? "DD/MM/YYYY",
      theme: profile?.theme ?? "dark",
    },
  });

  /** Persist the full profile row with the given preference overrides. */
  function persistPreferences(values: PreferencesValues) {
    startTransition(async () => {
      const result = await updateProfile({
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        currency: values.currency,
        date_format: values.date_format,
        theme: values.theme,
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  /**
   * Theme changes apply immediately via next-themes AND are persisted
   * to the profile row right away, so the choice survives a reload
   * without waiting for Save.
   */
  function handleThemeChange(value: string) {
    const theme = value as ThemePreference;
    form.setValue("theme", theme, { shouldDirty: true });
    setTheme(theme);
    persistPreferences({ ...form.getValues(), theme });
  }

  function onSubmit(values: PreferencesValues) {
    startTransition(async () => {
      const result = await updateProfile({
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        currency: values.currency,
        date_format: values.date_format,
        theme: values.theme,
      });
      if (result.ok) {
        toast.success("Preferences saved.");
      } else {
        toast.error(result.error);
      }
    });
  }

  const today = new Date();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="INR">INR — Indian Rupee (₹)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Display only — no conversion in the MVP.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date_format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date format</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a date format" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DATE_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format} ({formatDate(today, format)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                How dates are shown across Hisab.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="theme"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme</FormLabel>
              <Select
                value={field.value}
                onValueChange={handleThemeChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Applies right away and is saved to your profile.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          Save preferences
        </Button>
      </form>
    </Form>
  );
}
