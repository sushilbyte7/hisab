"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccountData } from "@/app/(dashboard)/settings/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM_WORD = "DELETE";

export function DangerZone() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const confirmed = confirmText.trim() === CONFIRM_WORD;

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setConfirmText("");
  }

  function handleDelete() {
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteAccountData();
      if (result.ok) {
        toast.success("Your data has been deleted.");
        router.push("/login");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-destructive">Delete account data</p>
        <p className="text-sm text-muted-foreground">
          Permanently delete your profile, transactions, budgets, and custom
          categories. This cannot be undone.
        </p>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Delete my data</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your profile, transactions, budgets,
              and custom categories, and signs you out. There is no way to
              recover it. Export your data first if you want a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="danger-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to
              confirm
            </Label>
            <Input
              id="danger-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={isPending}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!confirmed || isPending}
              variant="destructive"
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
