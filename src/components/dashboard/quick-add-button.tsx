"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import type { Category } from "@/types/database";

type ButtonVariants = VariantProps<typeof buttonVariants>;

interface QuickAddButtonProps {
  categories: Category[];
  label?: string;
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  className?: string;
}

/**
 * "Add Transaction" button that opens the shared TransactionDialog.
 * Refreshes the page data after a successful save.
 */
export function QuickAddButton({
  categories,
  label = "Add Transaction",
  variant = "default",
  size = "default",
  className,
}: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>
      <TransactionDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        onSaved={() => {
          router.refresh();
          toast.success("Transaction added");
        }}
      />
    </>
  );
}
