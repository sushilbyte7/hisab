"use client";

import { useState, useTransition } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory } from "@/app/(dashboard)/categories/actions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { Category, TransactionType } from "@/types/database";
import { CategoryDialog } from "./category-dialog";
import { CategoryIcon } from "./category-icon";

interface CategoryListProps {
  categories: Category[];
}

const GROUPS: Array<{ type: TransactionType; title: string }> = [
  { type: "expense", title: "Expense" },
  { type: "income", title: "Income" },
];

export function CategoryList({ categories }: CategoryListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditing(null);
  }

  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    const name = deleting.name;
    setDeleting(null);
    startDeleteTransition(async () => {
      const result = await deleteCategory(id);
      if (result.ok) {
        toast.success(`"${name}" deleted.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          New Category
        </Button>
      </div>

      {GROUPS.map(({ type, title }) => {
        const group = categories.filter((c) => c.type === type);
        return (
          <section key={type} aria-label={`${title} categories`}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {title} · {group.length}
            </h2>
            <Card>
              <CardContent className="p-0">
                {group.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No {title.toLowerCase()} categories yet. Create one to get
                    started.
                  </p>
                ) : (
                  <ul>
                    {group.map((category, index) => (
                      <li key={category.id}>
                        {index > 0 && <Separator />}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-md"
                            style={{
                              backgroundColor: `${category.color ?? "#94a3b8"}1a`,
                            }}
                          >
                            <CategoryIcon
                              name={category.icon}
                              color={category.color}
                              className="size-5"
                            />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {category.name}
                          </span>
                          {category.is_default ? (
                            <Badge variant="secondary">System</Badge>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${category.name}`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openEdit(category)}
                                >
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleting(category)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        );
      })}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        category={editing}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" will be permanently deleted. Categories in use by transactions or budgets can't be deleted.`
                : "This category will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
