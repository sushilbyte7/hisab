import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { CategoryList } from "@/components/categories/category-list";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/services/categories";
import type { Category } from "@/types/database";

export const metadata: Metadata = {
  title: "Categories | Hisab",
  description: "Manage your income and expense categories.",
};

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let categories: Category[] = [];
  let loadError: string | null = null;
  try {
    categories = await listCategories(user.id);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load categories.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          Organise your spending and income. System categories can&apos;t be
          edited or deleted.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              Couldn&apos;t load categories
            </p>
            <p className="text-muted-foreground">{loadError}</p>
          </div>
        </div>
      ) : (
        <CategoryList categories={categories} />
      )}
    </div>
  );
}
