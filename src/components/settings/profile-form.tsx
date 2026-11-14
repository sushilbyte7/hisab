"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updateProfile } from "@/app/(dashboard)/settings/actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import type { Profile } from "@/types/database";

const profileDetailsSchema = z.object({
  full_name: z.string().trim().max(200),
  avatar_url: z
    .union([z.literal(""), z.string().url("Avatar must be a valid URL")])
    .optional(),
});

type ProfileDetailsValues = z.infer<typeof profileDetailsSchema>;

interface ProfileFormProps {
  profile: Profile | null;
  email: string;
}

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
  return (email.slice(0, 2) || "H").toUpperCase();
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileDetailsValues>({
    resolver: zodResolver(profileDetailsSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      avatar_url: profile?.avatar_url ?? "",
    },
  });

  const watchedName = form.watch("full_name");
  const watchedAvatar = form.watch("avatar_url");

  function onSubmit(values: ProfileDetailsValues) {
    startTransition(async () => {
      // The profile action takes the whole profile; the fields this
      // form doesn't edit are carried over from the current profile.
      const result = await updateProfile({
        full_name: values.full_name?.trim() ? values.full_name : null,
        avatar_url: values.avatar_url?.trim() ? values.avatar_url : null,
        currency: profile?.currency ?? "INR",
        date_format: profile?.date_format ?? "DD/MM/YYYY",
        theme: profile?.theme ?? "dark",
      });
      if (result.ok) {
        toast.success("Profile saved.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage
              src={watchedAvatar?.trim() ? watchedAvatar : undefined}
              alt="Avatar preview"
            />
            <AvatarFallback className="text-base">
              {initials(watchedName ?? "", email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {watchedName?.trim() ? watchedName : "Your name"}
            </p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel htmlFor="profile-email">Email</FormLabel>
          <Input
            id="profile-email"
            value={email}
            disabled
            autoComplete="email"
          />
          <p className="text-sm text-muted-foreground">
            Your sign-in email can&apos;t be changed here.
          </p>
        </div>

        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://…"
                  autoComplete="off"
                  inputMode="url"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                A link to a square image. Leave empty to use your initials.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          Save profile
        </Button>
      </form>
    </Form>
  );
}
