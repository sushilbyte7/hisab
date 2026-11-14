"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { z } from "zod";

import { transactionFormSchema } from "@/lib/validations";
import { toISODate } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/database";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAYMENT_METHOD_SUGGESTIONS = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Other",
];

type FormInput = z.input<typeof transactionFormSchema>;
type FormOutput = z.output<typeof transactionFormSchema>;

function defaultValues(transaction?: Transaction): FormInput {
  if (transaction) {
    return {
      title: transaction.title,
      amount: String(transaction.amount),
      type: transaction.type,
      category_id: transaction.category_id,
      payment_method: transaction.payment_method ?? "",
      transaction_date: transaction.transaction_date,
      notes: transaction.notes ?? "",
    };
  }
  return {
    title: "",
    amount: "",
    type: "expense",
    category_id: "",
    payment_method: "",
    transaction_date: toISODate(new Date()),
    notes: "",
  };
}

export interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  transaction?: Transaction;
  onSaved?: () => void;
}

/**
 * Create/edit transaction dialog.
 *
 * NOTE: this component is shared with the dashboard workstream — keep
 * the prop API exactly as declared here.
 */
export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  transaction,
  onSaved,
}: TransactionDialogProps) {
  const isEditing = Boolean(transaction);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaultValues(transaction),
  });

  // Re-prefill whenever the dialog opens (or a different transaction is edited).
  useEffect(() => {
    if (open) form.reset(defaultValues(transaction));
  }, [open, transaction, form]);

  const type = useWatch({ control: form.control, name: "type" });
  const visibleCategories = categories.filter((c) => c.type === type);

  function handleTypeChange(next: "income" | "expense") {
    if (next === type) return;
    form.setValue("type", next, { shouldValidate: true });
    // A category of the old type is never valid for the new one.
    form.setValue("category_id", "", { shouldValidate: true });
  }

  async function onSubmit(values: FormOutput) {
    setSubmitting(true);
    const result = isEditing
      ? await updateTransaction(transaction!.id, values)
      : await createTransaction(values);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      isEditing ? "Transaction updated" : "Transaction added",
    );
    onSaved?.();
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!transaction) return;
    setDeleting(true);
    const result = await deleteTransaction(transaction.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaction deleted");
    setConfirmDelete(false);
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit transaction" : "New transaction"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details of this transaction."
                : "Record money in or out."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {/* Type toggle */}
              <div
                className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                role="group"
                aria-label="Transaction type"
              >
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors",
                      type === t
                        ? t === "expense"
                          ? "bg-red-500/15 text-red-500 dark:bg-red-500/20"
                          : "bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={type === t}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Weekly groceries"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transaction_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {visibleCategories.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No {type} categories yet
                          </SelectItem>
                        ) : (
                          visibleCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <span className="flex items-center gap-2">
                                {category.color ? (
                                  <span
                                    className="size-2.5 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                  />
                                ) : null}
                                {category.name}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment method (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cash, UPI, Card…"
                        list="hisab-payment-methods"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <datalist id="hisab-payment-methods">
                      {PAYMENT_METHOD_SUGGESTIONS.map((method) => (
                        <option key={method} value={method} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Anything worth remembering…"
                        rows={2}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                {isEditing ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={submitting || deleting}
                    className="sm:mr-auto"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {isEditing ? "Save changes" : "Add transaction"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              “{transaction?.title}” will be permanently deleted. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
