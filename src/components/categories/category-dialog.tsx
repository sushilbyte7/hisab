"use client";

import { useEffect, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createCategory,
  updateCategory,
} from "@/app/(dashboard)/categories/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/database";
import { CATEGORY_ICONS, CategoryIcon } from "./category-icon";

/** Fixed color palette offered for custom categories. */
export const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
] as const;

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this category; otherwise it creates one. */
  category?: Category | null;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: CategoryDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = category != null;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      type: "expense",
      icon: "MoreHorizontal",
      color: CATEGORY_COLORS[0],
    },
  });

  // Reset the form every time the dialog opens (create vs. edit, and
  // which category is being edited).
  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        type: category?.type ?? "expense",
        icon: category?.icon ?? "MoreHorizontal",
        color: category?.color ?? CATEGORY_COLORS[0],
      });
    }
  }, [open, category, form]);

  const watchedIcon = form.watch("icon");
  const watchedColor = form.watch("color");

  function onSubmit(values: CategoryFormValues) {
    startTransition(async () => {
      const result = isEditing
        ? await updateCategory(category.id, values)
        : await createCategory(values);
      if (result.ok) {
        toast.success(
          isEditing ? "Category updated." : "Category created.",
        );
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Change the name, icon, or color. The type can't change once the category has transactions."
              : "Add a custom category for your income or expenses."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Groceries"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        backgroundColor: `${watchedColor ?? "#94a3b8"}1a`,
                      }}
                    >
                      <CategoryIcon
                        name={watchedIcon}
                        color={watchedColor}
                        className="size-5"
                      />
                    </span>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_ICONS.map((iconName) => (
                          <SelectItem key={iconName} value={iconName}>
                            <span className="flex items-center gap-2">
                              <CategoryIcon
                                name={iconName}
                                className="size-4"
                              />
                              {iconName}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          aria-label={`Color ${hex}`}
                          aria-pressed={field.value === hex}
                          disabled={isPending}
                          onClick={() => field.onChange(hex)}
                          className={cn(
                            "size-8 rounded-full border transition-transform hover:scale-110",
                            field.value === hex &&
                              "ring-2 ring-ring ring-offset-2 ring-offset-background",
                          )}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                {isEditing ? "Save changes" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
