"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

import { budgetFormSchema } from "@/lib/validations";
import type { Budget, Category } from "@/types/database";
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from "@/app/(dashboard)/budgets/actions";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1, current + 2];
}

type FormInput = z.input<typeof budgetFormSchema>;
type FormOutput = z.output<typeof budgetFormSchema>;

function defaultValues(
  budget: Budget | undefined,
  month: number,
  year: number,
): FormInput {
  if (budget) {
    return {
      category_id: budget.category_id,
      amount: String(budget.amount),
      month: budget.month,
      year: budget.year,
    };
  }
  return { category_id: "", amount: "", month, year };
}

export interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expense categories only. */
  categories: Category[];
  budget?: Budget;
  /** Default month/year for a new budget (the month being viewed). */
  month: number;
  year: number;
  onSaved?: () => void;
}

export function BudgetDialog({
  open,
  onOpenChange,
  categories,
  budget,
  month,
  year,
  onSaved,
}: BudgetDialogProps) {
  const isEditing = Boolean(budget);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: defaultValues(budget, month, year),
  });

  useEffect(() => {
    if (open) form.reset(defaultValues(budget, month, year));
  }, [open, budget, month, year, form]);

  async function onSubmit(values: FormOutput) {
    setSubmitting(true);
    const result = isEditing
      ? await updateBudget(budget!.id, values)
      : await createBudget(values);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEditing ? "Budget updated" : "Budget created");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit budget" : "New budget"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Change the limit for this category."
              : "Set a monthly spending limit for an expense category."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an expense category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No expense categories yet
                        </SelectItem>
                      ) : (
                        categories.map((category) => (
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly limit (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
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
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={name} value={String(i + 1)}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {yearOptions().map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
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
                {isEditing ? "Save changes" : "Create budget"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** "New budget" button + dialog, for the budgets page header/empty state. */
export function NewBudgetButton({
  categories,
  month,
  year,
}: {
  categories: Category[];
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New budget
      </Button>
      <BudgetDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        month={month}
        year={year}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

/** Edit/Delete dropdown for a budget card, with a delete confirmation. */
export function BudgetCardActions({
  budget,
  categories,
  month,
  year,
}: {
  budget: Budget;
  categories: Category[];
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteBudget(budget.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Budget deleted");
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${budget.category?.name ?? "budget"}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BudgetDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        categories={categories}
        budget={budget}
        month={month}
        year={year}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>
              The {budget.category?.name ?? "category"} budget for{" "}
              {MONTH_NAMES[budget.month - 1]} {budget.year} will be removed.
              Past transactions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
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
